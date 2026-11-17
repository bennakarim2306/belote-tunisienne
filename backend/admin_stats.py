"""Admin statistics dashboard (HTML) — protected by FEEDBACK_ADMIN_KEY.

GET /api/admin/stats?key=... (route registered in server.py)
"""
import time
from datetime import datetime, timedelta, timezone

from html import escape

import server_metrics
import sync_channel


async def _event_rows(db, now_dt, minutes):
    """Per-type event stats over the last <minutes>: total, /min, distinct
    players, events per player per active minute."""
    since = now_dt - timedelta(minutes=minutes)
    totals = await db.server_metrics.aggregate([
        {"$match": {"ts": {"$gte": since}}},
        {"$project": {"type": 1, "n": 1,
                      "pm": {"$size": {"$ifNull": ["$users", []]}}}},
        {"$group": {"_id": "$type", "n": {"$sum": "$n"},
                    "pm": {"$sum": "$pm"}}},
    ]).to_list(300)
    distinct = await db.server_metrics.aggregate([
        {"$match": {"ts": {"$gte": since}}},
        {"$unwind": "$users"},
        {"$match": {"users": {"$ne": "_anon"}}},
        {"$group": {"_id": {"t": "$type", "u": "$users"}}},
        {"$group": {"_id": "$_id.t", "players": {"$sum": 1}}},
    ]).to_list(300)
    players = {r["_id"]: r["players"] for r in distinct}
    rows = []
    for r in sorted(totals, key=lambda x: -x["n"]):
        pm = r["pm"]  # player-minutes: sum over minute buckets of active players
        rows.append({
            "type": r["_id"],
            "n": r["n"],
            "per_min": round(r["n"] / minutes, 2),
            "players": players.get(r["_id"], 0),
            "per_player_min": round(r["n"] / pm, 2) if pm else None,
        })
    return rows


async def collect_stats(db):
    now = time.time()
    now_dt = datetime.now(timezone.utc)

    def iso_ago(days):
        return (now_dt - timedelta(days=days)).isoformat()

    s = {}

    # ---- players ----
    s["total_users"] = await db.users.count_documents({})
    s["new_30d"] = await db.users.count_documents({"created_at": {"$gt": iso_ago(30)}})
    s["active_24h"] = await db.users.count_documents({"last_active": {"$gt": now - 86400}})
    s["active_7d"] = await db.users.count_documents({"last_active": {"$gt": now - 7 * 86400}})
    s["active_30d"] = await db.users.count_documents({"last_active": {"$gt": now - 30 * 86400}})
    s["online_now"] = await db.users.count_documents({"last_active": {"$gt": now - 90}})

    # ---- live right now ----
    entries = await db.mm_queue.find({}, {"players": 1}).to_list(200)
    s["waiting_now"] = len({p["user_id"] for e in entries for p in e["players"]})
    # only games with RECENT activity (heartbeat/bot action < 2 min): abandoned
    # games linger in live_games up to 30 min before the sweep removes them —
    # they must not show as "en cours" while "connectés maintenant" is 0
    s["live_games_now"] = await db.live_games.count_documents(
        {"phase": {"$ne": "finished"}, "updated_at": {"$gt": now - 120}})

    # ---- server matches, split by composition:
    # humans >= 2 -> real online games between players
    # humans <= 1 -> vs-AI games that old app versions played through the
    #                server (legacy solo + tutorial coach games)
    HUMANS = {"$size": {"$filter": {"input": {"$ifNull": ["$players", []]},
                                    "as": "p",
                                    "cond": {"$eq": ["$$p.is_bot", False]}}}}
    base = [{"$project": {"finished_at": 1, "ranked": 1, "hands_played": 1,
                          "players": 1, "humans": HUMANS}}]

    async def _count(extra):
        rows = await db.matches.aggregate(base + extra + [{"$count": "n"}]).to_list(1)
        return rows[0]["n"] if rows else 0

    s["matches_total"] = await _count([{"$match": {"humans": {"$gte": 2}}}])
    s["matches_30d"] = await _count([
        {"$match": {"humans": {"$gte": 2}, "finished_at": {"$gt": iso_ago(30)}}}])
    s["matches_7d"] = await _count([
        {"$match": {"humans": {"$gte": 2}, "finished_at": {"$gt": iso_ago(7)}}}])
    # ranked games BETWEEN PLAYERS only (private rooms are ranked even with
    # bots — those belong to the vs-AI bucket, not here)
    s["matches_ranked"] = await _count([
        {"$match": {"humans": {"$gte": 2}, "ranked": True}}])

    peak = await db.matches.aggregate(base + [
        {"$match": {"humans": {"$gte": 2}}},
        {"$project": {"day": {"$substrBytes": ["$finished_at", 0, 10]}}},
        {"$group": {"_id": "$day", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 1},
    ]).to_list(1)
    s["peak_day"] = peak[0]["_id"] if peak else "—"
    s["peak_day_count"] = peak[0]["n"] if peak else 0

    avg_hands = await db.matches.aggregate(base + [
        {"$match": {"humans": {"$gte": 2}}},
        {"$group": {"_id": None, "avg": {"$avg": "$hands_played"}}},
    ]).to_list(1)
    s["avg_hands"] = round(avg_hands[0]["avg"], 1) if avg_hands else 0

    # per-human-player counts over 30 days (all server matches, for top 5)
    all30 = await db.matches.aggregate(base + [
        {"$match": {"finished_at": {"$gt": iso_ago(30)}}},
        {"$unwind": "$players"},
        {"$match": {"players.is_bot": False}},
        {"$group": {"_id": "$players.user_id", "n": {"$sum": 1},
                    "online": {"$sum": {"$cond": [{"$gte": ["$humans", 2]}, 1, 0]}},
                    "ai": {"$sum": {"$cond": [{"$lte": ["$humans", 1]}, 1, 0]}}}},
    ]).to_list(5000)
    online_players = [r for r in all30 if r["online"] > 0]
    s["online_avg_per_player"] = (
        round(sum(r["online"] for r in online_players) / len(online_players), 1)
        if online_players else 0
    )

    # ---- vs-AI games: legacy server games + offline telemetry (new builds) ----
    s["ai_server_total"] = await _count([{"$match": {"humans": {"$lte": 1}}}])
    s["ai_server_30d"] = await _count([
        {"$match": {"humans": {"$lte": 1}, "finished_at": {"$gt": iso_ago(30)}}}])
    s["offline_total"] = await db.offline_matches.count_documents({})
    s["offline_30d"] = await db.offline_matches.count_documents(
        {"finished_at": {"$gt": iso_ago(30)}})
    off30 = await db.offline_matches.aggregate([
        {"$match": {"finished_at": {"$gt": iso_ago(30)}}},
        {"$group": {"_id": "$user_id", "n": {"$sum": 1}}},
    ]).to_list(5000)
    s["ai_total"] = s["ai_server_total"] + s["offline_total"]
    s["ai_30d"] = s["ai_server_30d"] + s["offline_30d"]
    # average vs-AI games per player (30 d): server-AI + offline, per distinct player
    ai_counts = {r["_id"]: r["ai"] for r in all30 if r["ai"] > 0}
    for r in off30:
        ai_counts[r["_id"]] = ai_counts.get(r["_id"], 0) + r["n"]
    s["ai_avg_per_player"] = (
        round(sum(ai_counts.values()) / len(ai_counts), 1) if ai_counts else 0
    )

    # ---- top 5 most active players (30 days, all game types) ----
    counts = {r["_id"]: r["n"] for r in all30}
    for r in off30:
        counts[r["_id"]] = counts.get(r["_id"], 0) + r["n"]
    top5 = sorted(counts.items(), key=lambda x: -x[1])[:5]
    names = {}
    if top5:
        async for u in db.users.find(
            {"user_id": {"$in": [t[0] for t in top5]}},
            {"user_id": 1, "username": 1},
        ):
            names[u["user_id"]] = u.get("username", "?")
    s["top5"] = [(names.get(uid, uid), n) for uid, n in top5]

    # ---- server usage ----
    s["ws_connections"] = server_metrics.active_ws_connections()
    s["sync_channels"] = sync_channel.connection_count()
    s["ev60"] = await _event_rows(db, now_dt, 60)
    s["ev24"] = await _event_rows(db, now_dt, 1440)
    s["ev60_total"] = sum(r["n"] for r in s["ev60"])
    s["ev24_total"] = sum(r["n"] for r in s["ev24"])
    s["ai_server_24h"] = await _count([
        {"$match": {"humans": {"$lte": 1}, "finished_at": {"$gt": iso_ago(1)}}}])
    comp = await db.matches.aggregate(base + [
        {"$group": {"_id": "$humans", "n": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
    ]).to_list(10)
    s["composition"] = [(r["_id"], r["n"]) for r in comp]
    try:
        st = await db.command("dbStats")
        s["db_mb"] = round(
            (st.get("dataSize", 0) + st.get("indexSize", 0)) / 1e6, 1)
    except Exception:
        s["db_mb"] = "—"

    # ---- reliability / absence counters (Phase 1 inactivity plan) ----
    rel = await db.reliability_events.aggregate([
        {"$match": {"ts": {"$gte": now_dt - timedelta(days=7)}}},
        {"$group": {"_id": "$kind", "n7": {"$sum": 1},
                    "n1": {"$sum": {"$cond": [
                        {"$gte": ["$ts", now_dt - timedelta(days=1)]},
                        1, 0]}}}},
    ]).to_list(10)
    relmap = {r["_id"]: (r["n1"], r["n7"]) for r in rel}
    s["rel_missed"] = relmap.get("missed_turn", (0, 0))
    s["rel_takeover"] = relmap.get("bot_takeover", (0, 0))
    s["rel_noaccept"] = relmap.get("no_accept", (0, 0))

    s["generated_at"] = now_dt.strftime("%d/%m/%Y %H:%M UTC")
    return s


def _card(label, value, sub=""):
    sub_html = f'<div class="sub">{escape(str(sub))}</div>' if sub else ""
    return (f'<div class="card"><div class="val">{escape(str(value))}</div>'
            f'<div class="lbl">{escape(label)}</div>{sub_html}</div>')


def _ev_table(rows):
    body = "".join(
        f"<tr><td>{escape(str(r['type']))}</td><td>{r['n']}</td>"
        f"<td>{r['per_min']}</td><td>{r['players'] or '—'}</td>"
        f"<td>{r['per_player_min'] if r['per_player_min'] is not None else '—'}</td></tr>"
        for r in rows
    ) or '<tr><td colspan="5">Aucune donnée pour l’instant</td></tr>'
    return ('<table class="wide"><tr><th>Type d’événement</th><th>Événements</th>'
            '<th>Évts/min</th><th>Joueurs</th><th>Évts/joueur/min</th></tr>'
            f'{body}</table>')


async def render_stats_html(db):
    s = await collect_stats(db)
    top_rows = "".join(
        f"<tr><td>{i + 1}</td><td>{escape(name)}</td><td>{n}</td></tr>"
        for i, (name, n) in enumerate(s["top5"])
    ) or '<tr><td colspan="3">Aucune donnée</td></tr>'
    comp_labels = {4: "4 humains — partie en ligne classique",
                   3: "3 humains + 1 bot",
                   2: "2 humains + 2 bots — duo contre IA / salon",
                   1: "1 humain — ancien solo via serveur / tutoriel",
                   0: "0 humain"}
    comp_rows = "".join(
        f"<tr><td>{escape(comp_labels.get(h, f'{h} humains'))}</td><td>{n}</td></tr>"
        for h, n in s["composition"]
    ) or '<tr><td colspan="2">Aucune donnée</td></tr>'

    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Belote Tunisienne — Statistiques</title>
<style>
  body {{ margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0d1f16; color:#f5ead1; padding:24px; }}
  h1 {{ color:#e9c46a; font-size:22px; margin:0 0 4px; }}
  .gen {{ color:rgba(245,234,209,.55); font-size:12px; margin-bottom:20px; }}
  h2 {{ color:#e9c46a; font-size:15px; margin:26px 0 10px;
       border-bottom:1px solid rgba(233,196,106,.3); padding-bottom:6px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:12px; }}
  .card {{ background:#122b1e; border:1px solid rgba(233,196,106,.35);
          border-radius:12px; padding:14px; }}
  .val {{ font-size:26px; font-weight:800; color:#fff; }}
  .lbl {{ font-size:12.5px; color:rgba(245,234,209,.8); margin-top:4px; }}
  .sub {{ font-size:11px; color:rgba(245,234,209,.5); margin-top:2px; }}
  table {{ width:100%; max-width:480px; border-collapse:collapse; margin-top:6px; }}
  table.wide {{ max-width:720px; }}
  td, th {{ text-align:left; padding:7px 10px; font-size:13.5px;
           border-bottom:1px solid rgba(233,196,106,.15); }}
  th {{ color:#e9c46a; font-size:12px; }}
  .note {{ font-size:11.5px; color:rgba(245,234,209,.5); margin-top:16px; }}
</style></head><body>
<h1>📊 Belote Tunisienne — Statistiques</h1>
<div class="gen">Généré le {s["generated_at"]} — actualiser la page pour mettre à jour</div>

<h2>Joueurs</h2>
<div class="grid">
  {_card("Joueurs inscrits (total)", s["total_users"])}
  {_card("Nouveaux joueurs (30 j)", s["new_30d"])}
  {_card("Joueurs actifs (30 j)", s["active_30d"])}
  {_card("Joueurs actifs (7 j)", s["active_7d"])}
  {_card("Joueurs actifs (24 h)", s["active_24h"])}
</div>

<h2>En ce moment</h2>
<div class="grid">
  {_card("Connectés maintenant", s["online_now"])}
  {_card("En file d'attente", s["waiting_now"])}
  {_card("Parties en cours (serveur)", s["live_games_now"], "activité < 2 min")}
</div>

<h2>Parties en ligne (entre joueurs)</h2>
<div class="grid">
  {_card("Parties jouées (total)", s["matches_total"])}
  {_card("Parties jouées (30 j)", s["matches_30d"])}
  {_card("Parties jouées (7 j)", s["matches_7d"])}
  {_card("Record en 1 jour", s["peak_day_count"], s["peak_day"])}
  {_card("Parties classées (total)", s["matches_ranked"])}
  {_card("Moyenne par joueur (30 j)", s["online_avg_per_player"])}
  {_card("Durée moyenne (manches)", s["avg_hands"])}
</div>

<h2>Parties contre l'IA</h2>
<div class="grid">
  {_card("Parties jouées (total)", s["ai_total"])}
  {_card("Parties jouées (30 j)", s["ai_30d"])}
  {_card("Moyenne par joueur (30 j)", s["ai_avg_per_player"])}
  {_card("…dont via serveur", s["ai_server_total"], "anciennes versions + tutoriel")}
  {_card("…dont hors-ligne", s["offline_total"], "télémétrie, nouvelles versions")}
</div>

<h2>Utilisation du serveur</h2>
<div class="grid">
  {_card("Connexions WS actives", s["ws_connections"], "sockets de jeu ouverts")}
  {_card("Canaux sync connectés", s["sync_channels"], "joueurs en temps réel")}
  {_card("Événements (60 min)", s["ev60_total"], "API + WebSocket")}
  {_card("Événements (24 h)", s["ev24_total"], "API + WebSocket")}
  {_card("Parties IA via serveur (24 h)", s["ai_server_24h"])}
  {_card("Base de données (Mo)", s["db_mb"], "données + index")}
</div>

<h3 style="color:#e9c46a;font-size:13.5px;margin:18px 0 2px">Événements app ↔ serveur par type — 60 dernières minutes</h3>
{_ev_table(s["ev60"])}

<h3 style="color:#e9c46a;font-size:13.5px;margin:18px 0 2px">Événements app ↔ serveur par type — 24 dernières heures</h3>
{_ev_table(s["ev24"])}

<h3 style="color:#e9c46a;font-size:13.5px;margin:18px 0 2px">Parties serveur par composition (total)</h3>
<table><tr><th>Composition</th><th>Parties</th></tr>{comp_rows}</table>

<h2>Fiabilité des joueurs (24 h / 7 j)</h2>
<div class="grid">
  {_card("Tours manqués", f"{s['rel_missed'][0]} / {s['rel_missed'][1]}", "tour expiré, carte jouée d'office")}
  {_card("Relais par le bot", f"{s['rel_takeover'][0]} / {s['rel_takeover'][1]}", "3 tours manqués de suite")}
  {_card("Non-acceptations", f"{s['rel_noaccept'][0]} / {s['rel_noaccept'][1]}", "match trouvé non accepté en 10 s")}
</div>

<h2>Top 5 joueurs les plus actifs (30 j, tous modes serveur + hors-ligne)</h2>
<table><tr><th>#</th><th>Joueur</th><th>Parties</th></tr>{top_rows}</table>

<div class="note">ℹ️ « Contre l'IA » regroupe : les parties solo que les anciennes versions
jouaient via le serveur (+ parties du tutoriel), et les parties hors-ligne remontées par la
télémétrie des nouvelles versions de l'application. Les parties hors-ligne des anciennes
versions restent invisibles (aucune donnée n'était envoyée).<br>
ℹ️ « Évts/joueur/min » = événements divisés par les minutes d'activité réelles des joueurs
(un joueur inactif ne dilue pas la moyenne). Les événements serveur sont conservés 7 jours
et le comptage démarre au déploiement de cette version.<br>
🎯 Cibles d'efficacité (après mise à jour de l'app) : « sync (regroupé) » remplace
présence + amis + reprise de partie (&lt; 2 évts/joueur/min attendus), « ws: état envoyé »
divisé par ~2, zéro appel quand l'app est en arrière-plan.</div>
</body></html>"""
