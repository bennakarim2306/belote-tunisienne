// Structured Belote Tunisienne curriculum — 14 sequential lessons, trilingual.
// Content mirrors the exact rules implemented in backend/game_logic.py:
// contract tolerance -5, contre 320 / surcontre 640 / announced capot 500 /
// silent capot 250, scores rounded to nearest 10, 10 de der, Tfaskira.

export interface LessonText {
  fr: string;
  en: string;
  ar: string;
}

export interface Lesson {
  id: string;
  icon: string; // Ionicons name
  title: LessonText;
  paragraphs: LessonText[];
  tip?: LessonText;
}

export const LESSONS: Lesson[] = [
  {
    id: "welcome",
    icon: "school",
    title: {
      fr: "Bienvenue !",
      en: "Welcome!",
      ar: "مرحبا بيك !",
    },
    paragraphs: [
      {
        fr: "La Belote Tunisienne se joue à 4 joueurs, en 2 équipes de 2 : ton partenaire est le joueur assis en face de toi. Dans ce tutoriel, tu apprends pas à pas avec 3 IA pédagogiques.",
        en: "Tunisian Belote is played by 4 players in 2 teams of 2: your partner is the player sitting across from you. In this tutorial you learn step by step with 3 teaching AIs.",
        ar: "البلوت التونسية تتلعب بـ4 لاعبين، زوز فرق في كل فريق زوز : شريكك هو اللاعب اللي قاعد قبالتك. في الدورة هاذي باش تتعلم خطوة بخطوة مع 3 روبوات معلمين.",
      },
      {
        fr: "Le jeu utilise 32 cartes : le 7, 8, 9, 10, Valet, Dame, Roi et As dans les 4 couleurs (♠ ♥ ♦ ♣). Chaque joueur reçoit 8 cartes.",
        en: "The game uses 32 cards: 7, 8, 9, 10, Jack, Queen, King and Ace in the 4 suits (♠ ♥ ♦ ♣). Each player receives 8 cards.",
        ar: "اللعبة فيها 32 كارطة : 7، 8، 9، 10، الفالاّ، الدامة، الرّي والآص في الألوان الأربعة (♠ ♥ ♦ ♣). كل لاعب ياخو 8 كروط.",
      },
      {
        fr: "Le but : marquer des points en gagnant des plis. La première équipe qui atteint 1000 points (partie courte) ou 2000 points (partie longue) remporte la partie.",
        en: "The goal: score points by winning tricks. The first team to reach 1000 points (short game) or 2000 points (long game) wins the match.",
        ar: "الهدف : تجمع نقاط بالربح في اللعبات. أول فريق يوصل 1000 نقطة (حصة قصيرة) ولا 2000 نقطة (حصة طويلة) يربح الحصة.",
      },
    ],
    tip: {
      fr: "Tu ne peux pas sauter d'étapes, mais tu peux revenir à tout moment aux leçons déjà terminées.",
      en: "You cannot skip steps, but you can always come back to lessons you have already finished.",
      ar: "ما تنجمش تنقّز على الدروس، أما تنجم ترجع وقتلي تحب للدروس اللي كملتهم.",
    },
  },
  {
    id: "trump",
    icon: "flash",
    title: {
      fr: "L'atout",
      en: "The trump suit",
      ar: "الأتو",
    },
    paragraphs: [
      {
        fr: "À chaque donne, une couleur est choisie comme atout. Les cartes d'atout sont plus fortes que toutes les autres : le plus petit atout bat même l'As d'une autre couleur.",
        en: "In every hand, one suit is chosen as trump. Trump cards beat every other card: the smallest trump even beats the Ace of another suit.",
        ar: "في كل توزيعة، نختاروا لون يولي هو الأتو. كروط الأتو أقوى من الكل : أصغر أتو يغلب حتى آص من لون آخر.",
      },
      {
        fr: "L'équipe qui choisit l'atout (les « attaquants ») s'engage à réaliser un certain nombre de points : c'est le contrat. L'autre équipe (les « défenseurs ») essaie de la faire chuter.",
        en: "The team that picks the trump (the “attackers”) commits to scoring a certain number of points: that is the contract. The other team (the “defenders”) tries to make them fail.",
        ar: "الفريق اللي يختار الأتو (المهاجمين) يلتزم يعمل عدد نقاط معيّن : هذاكا هو الكونترا. الفريق الآخر (المدافعين) يحاول يطيّحهم.",
      },
    ],
    tip: {
      fr: "Choisis l'atout dans ta couleur la plus longue et la plus forte — idéalement avec le Valet et le 9.",
      en: "Pick the trump in your longest, strongest suit — ideally holding the Jack and the 9.",
      ar: "اختار الأتو في أطول وأقوى لون عندك — والأفضل كي يكون عندك الفالاّ والتسعة.",
    },
  },
  {
    id: "values",
    icon: "layers",
    title: {
      fr: "Valeur et force des cartes",
      en: "Card values and strength",
      ar: "قيمة وقوة الكروط",
    },
    paragraphs: [
      {
        fr: "À l'atout, l'ordre change ! Du plus fort au plus faible : Valet (20 pts), 9 (14), As (11), 10 (10), Roi (4), Dame (3), 8 et 7 (0).",
        en: "In trumps, the order changes! From strongest to weakest: Jack (20 pts), 9 (14), Ace (11), 10 (10), King (4), Queen (3), 8 and 7 (0).",
        ar: "في الأتو، الترتيب يتبدل ! من الأقوى للأضعف : الفالاّ (20 نقطة)، التسعة (14)، الآص (11)، العشرة (10)، الرّي (4)، الدامة (3)، الثمنية والسبعة (0).",
      },
      {
        fr: "Dans les autres couleurs : As (11), 10 (10), Roi (4), Dame (3), Valet (2), puis 9, 8 et 7 (0).",
        en: "In the other suits: Ace (11), 10 (10), King (4), Queen (3), Jack (2), then 9, 8 and 7 (0).",
        ar: "في الألوان الأخرى : الآص (11)، العشرة (10)، الرّي (4)، الدامة (3)، الفالاّ (2)، وبعد التسعة والثمنية والسبعة (0).",
      },
      {
        fr: "Le total des cartes vaut 152 points, plus 10 points pour le dernier pli (le « 10 de der ») : chaque donne se joue donc sur 162 points.",
        en: "All the cards add up to 152 points, plus 10 points for the last trick (the “10 de der”): every hand is played over 162 points.",
        ar: "مجموع الكروط الكل 152 نقطة، وزيد 10 نقاط لآخر لعبة (« 10 دي دار ») : يعني كل توزيعة تتلعب على 162 نقطة.",
      },
    ],
    tip: {
      fr: "Retiens surtout : à l'atout, le Valet et le 9 sont les maîtres. Ailleurs, c'est l'As puis le 10.",
      en: "Remember above all: in trumps, the Jack and the 9 are the masters. Elsewhere, it's the Ace then the 10.",
      ar: "احفظ هاذي : في الأتو، الفالاّ والتسعة هوما الكبار. في البقية، الآص وبعده العشرة.",
    },
  },
  {
    id: "deal",
    icon: "albums",
    title: {
      fr: "La donne",
      en: "The deal",
      ar: "التوزيعة",
    },
    paragraphs: [
      {
        fr: "Le donneur distribue 8 cartes à chaque joueur. Après chaque donne, le rôle de donneur passe au joueur suivant.",
        en: "The dealer gives 8 cards to each player. After every hand, the dealer role moves to the next player.",
        ar: "الموزّع يعطي 8 كروط لكل لاعب. بعد كل توزيعة، الموزّع يتبدل ويولي اللاعب اللي بعده.",
      },
      {
        fr: "Le joueur assis après le donneur parle en premier aux annonces, puis chacun s'exprime à son tour dans le sens du jeu.",
        en: "The player sitting after the dealer speaks first in the bidding, then everyone speaks in turn following the direction of play.",
        ar: "اللاعب اللي بعد الموزّع هو اللي يبدا يحكي في الآنونصات، وبعد كل واحد يحكي في دوره.",
      },
    ],
  },
  {
    id: "bidding",
    icon: "megaphone",
    title: {
      fr: "Les annonces",
      en: "Bidding",
      ar: "الآنونصات",
    },
    paragraphs: [
      {
        fr: "Chacun à son tour annonce un contrat (de 90 à 160, par paliers de 10) avec une couleur d'atout, ou passe. Chaque nouvelle annonce doit être supérieure à la précédente.",
        en: "Each player in turn either bids a contract (from 90 to 160, in steps of 10) with a trump suit, or passes. Every new bid must be higher than the previous one.",
        ar: "كل واحد في دوره يعلن كونترا (من 90 لـ160، عشرة عشرة) مع لون أتو، ولا يعمل باصي. كل آنونص جديد لازمو يكون أكبر من اللي قبلو.",
      },
      {
        fr: "Les annonces s'arrêtent quand 3 joueurs passent après la dernière annonce. L'équipe du dernier annonceur devient attaquante, avec la couleur choisie comme atout.",
        en: "Bidding ends when 3 players pass after the last bid. The last bidder's team becomes the attackers, with the chosen suit as trump.",
        ar: "الآنونصات توفى كي 3 لاعبين يعملوا باصي بعد آخر آنونص. فريق آخر واحد أعلن يولي هو المهاجم، واللون اللي اختارو يولي الأتو.",
      },
      {
        fr: "Si les 4 joueurs passent d'entrée, la donne est annulée et on redistribue.",
        en: "If all 4 players pass right away, the hand is cancelled and the cards are dealt again.",
        ar: "كان الأربعة لاعبين الكل عملوا باصي من الأول، التوزيعة تتفسخ ونعاودوا نوزعوا.",
      },
      {
        fr: "Pour réussir son contrat, l'équipe attaquante doit totaliser au moins la valeur annoncée, avec une tolérance de 5 points : pour 90 annoncés, 85 points suffisent.",
        en: "To make their contract, the attacking team must total at least the announced value, with a 5-point tolerance: for a bid of 90, 85 points are enough.",
        ar: "باش تنجح الكونترا، الفريق المهاجم لازمو يجمع على الأقل القيمة اللي أعلنها، مع تسامح بـ5 نقاط : أعلنت 90؟ 85 نقطة يكفيوا.",
      },
    ],
  },
  {
    id: "contre",
    icon: "hand-left",
    title: {
      fr: "Contre et Sur-contre",
      en: "Double and Redouble",
      ar: "الكونتر والسيركونتر",
    },
    paragraphs: [
      {
        fr: "Si tu penses que le contrat adverse va chuter, tu peux « contrer ». La donne vaut alors 320 points fixes, remportés par l'équipe qui a raison.",
        en: "If you think the opponents' contract will fail, you can “double”. The hand is then worth a fixed 320 points, taken by whichever team is right.",
        ar: "كان تحس اللي كونترا الخصم باش تطيح، تنجم تعمل « كونتر ». التوزيعة وقتها تولي تسوى 320 نقطة، ياخوها الفريق اللي عندو الحق.",
      },
      {
        fr: "L'équipe contrée peut répondre par un « sur-contre » : la donne monte à 640 points fixes. Quitte ou double !",
        en: "The doubled team can answer with a “redouble”: the hand rises to a fixed 640 points. Double or nothing!",
        ar: "الفريق اللي تعملو كونتر ينجم يرد بـ« سيركونتر » : التوزيعة تطلع لـ640 نقطة. يا الكل يا شيء !",
      },
    ],
    tip: {
      fr: "Ne contre que si tu es fort dans l'atout adverse ou si tu comptes des points sûrs dans plusieurs couleurs.",
      en: "Only double if you are strong in the opponents' trump or you can count sure points in several suits.",
      ar: "ما تعملش كونتر كان ما تكونش قوي في أتو الخصم ولا عندك نقاط مضمونة في برشا ألوان.",
    },
  },
  {
    id: "capot",
    icon: "flame",
    title: {
      fr: "Le Capot",
      en: "The Capot",
      ar: "الكابو",
    },
    paragraphs: [
      {
        fr: "Annoncer « Capot », c'est promettre que ton équipe remportera les 8 plis de la donne. C'est l'annonce suprême : elle bat toutes les autres.",
        en: "Bidding “Capot” means promising that your team will win all 8 tricks of the hand. It is the ultimate bid: it beats every other bid.",
        ar: "تعلن « كابو » معناها توعد اللي فريقك باش يربح الـ8 لعبات الكل. هو أعلى آنونص : يغلب الآنونصات الكل.",
      },
      {
        fr: "Capot annoncé et réussi : 500 points. Raté (un seul pli perdu suffit) : les 500 points partent chez les adversaires.",
        en: "Announced and made Capot: 500 points. Failed (losing a single trick is enough): the 500 points go to the opponents.",
        ar: "كابو معلن وناجح : 500 نقطة. طايح (لعبة وحدة مخسورة تكفي) : الـ500 نقطة يمشيوا للخصم.",
      },
      {
        fr: "Si une équipe remporte tous les plis sans l'avoir annoncé, elle marque 250 points.",
        en: "If a team wins every trick without having announced it, it scores 250 points.",
        ar: "كان فريق ربح اللعبات الكل من غير ما يعلن كابو، ياخو 250 نقطة.",
      },
    ],
  },
  {
    id: "follow",
    icon: "arrow-up-circle",
    title: {
      fr: "Fournir et monter à l'atout",
      en: "Following suit and climbing in trumps",
      ar: "تمد اللون وتطلع في الأتو",
    },
    paragraphs: [
      {
        fr: "Tu dois toujours fournir la couleur demandée si tu en as. Il est interdit de jouer une autre couleur quand tu peux fournir.",
        en: "You must always follow the led suit if you have it. Playing another suit while you can follow is forbidden.",
        ar: "ديما لازمك تمد اللون المطلوب كان عندك منو. ممنوع تلعب لون آخر وإنت تنجم تمد.",
      },
      {
        fr: "Quand l'atout est demandé, tu dois « monter » : jouer un atout plus fort que le plus fort déjà posé, si tu le peux.",
        en: "When trumps are led, you must “climb”: play a trump higher than the strongest one already on the table, if you can.",
        ar: "كي يتطلب الأتو، لازمك « تطلع » : تلعب أتو أقوى من أقوى واحد محطوط، كان تنجم.",
      },
    ],
  },
  {
    id: "cut",
    icon: "cut",
    title: {
      fr: "Couper et se défausser",
      en: "Cutting and discarding",
      ar: "تقص وترمي",
    },
    paragraphs: [
      {
        fr: "Si tu n'as pas la couleur demandée, tu dois couper avec un atout — et surcouper (jouer un atout plus fort) si un adversaire a déjà coupé.",
        en: "If you don't have the led suit, you must cut with a trump — and overcut (play a higher trump) if an opponent has already cut.",
        ar: "كان ما عندكش اللون المطلوب، لازمك تقص بأتو — وتقص أعلى (أتو أقوى) كان خصم قص قبلك.",
      },
      {
        fr: "Sans atout, tu te défausses : tu jettes la carte de ton choix, mais elle ne peut pas gagner le pli.",
        en: "With no trump left, you discard: throw any card you like, but it cannot win the trick.",
        ar: "بلا أتو، ترمي : تلوّح الكارطة اللي تحب، أما ما تنجمش تربح بيها اللعبة.",
      },
    ],
  },
  {
    id: "tfaskira",
    icon: "swap-horizontal",
    title: {
      fr: "La Tfaskira (fausse-carte)",
      en: "The Tfaskira (false card)",
      ar: "التفسكيرة",
    },
    paragraphs: [
      {
        fr: "Exception tunisienne à l'obligation de couper : si ton partenaire est maître du pli, tu as le droit de jeter n'importe quelle carte au lieu de couper.",
        en: "A Tunisian exception to the obligation to cut: if your partner is currently winning the trick, you may throw any card instead of cutting.",
        ar: "استثناء تونسي على واجب القص : كان شريكك هو المولى في اللعبة، عندك الحق ترمي أي كارطة عوض ما تقص.",
      },
      {
        fr: "Elle s'applique en 3e position (ton partenaire a ouvert et reste maître) ou en 4e position (ton partenaire tient le pli). Jamais en 2e position.",
        en: "It applies in 3rd position (your partner led and is still winning) or in 4th position (your partner holds the trick). Never in 2nd position.",
        ar: "تصلح في البلاصة الثالثة (شريكك بدا ومازال مولى) ولا الرابعة (شريكك ماسك اللعبة). في البلاصة الثانية لا، أبداً.",
      },
      {
        fr: "Limite : si tu n'as QUE des atouts en main et que ton partenaire est maître avec un atout, tu dois monter à l'atout si tu peux — la Tfaskira ne permet jamais de sous-couper.",
        en: "Limit: if you hold ONLY trumps and your partner is winning with a trump, you must overtrump if you can — the Tfaskira never allows under-trumping.",
        ar: "حدّ : كان ما عندكش كان الأتو في يدك وشريكك مولى بأتو، لازمك تطلع بالأتو كان تنجم — التفسكيرة ما تسمحش أبداً بالقص بالصغير.",
      },
      {
        fr: "Attention : si l'atout est demandé, l'obligation de monter reste — Tfaskira ou pas.",
        en: "Careful: when trumps are led, the obligation to climb still stands — Tfaskira or not.",
        ar: "رد بالك : كي يتطلب الأتو، واجب الطلوع يقعد — تفسكيرة ولا لا.",
      },
    ],
    tip: {
      fr: "Utilise la Tfaskira pour économiser tes atouts, ou pour donner des points (un 10, un As) au pli de ton partenaire maître.",
      en: "Use the Tfaskira to save your trumps, or to feed points (a 10, an Ace) into your winning partner's trick.",
      ar: "استعمل التفسكيرة باش توفّر الأتو متاعك، ولا باش تعبّي نقاط (عشرة، آص) في لعبة شريكك المولى.",
    },
  },
  {
    id: "belote",
    icon: "heart-circle",
    title: {
      fr: "Belote-Rebelote",
      en: "Belote-Rebelote",
      ar: "بلوت-ربلوت",
    },
    paragraphs: [
      {
        fr: "Si tu tiens le Roi ET la Dame d'atout, annonce « Belote ! » en jouant la première carte et « Rebelote ! » en jouant la seconde : +20 points pour ton équipe.",
        en: "If you hold both the King AND the Queen of trumps, announce “Belote!” when playing the first one and “Rebelote!” when playing the second: +20 points for your team.",
        ar: "كان عندك الرّي والدامة متاع الأتو مع بعضهم، قول « بلوت ! » كي تلعب الأولى و« ربلوت ! » كي تلعب الثانية : +20 نقطة لفريقك.",
      },
      {
        fr: "Ces 20 points comptent aussi dans le calcul du contrat — ils peuvent sauver une donne serrée.",
        en: "Those 20 points also count towards the contract — they can save a tight hand.",
        ar: "الـ20 نقطة هاذم يتحسبوا زادة في الكونترا — ينجموا يسلكوا توزيعة صعيبة.",
      },
    ],
  },
  {
    id: "scoring",
    icon: "calculator",
    title: {
      fr: "Le score d'une donne",
      en: "Scoring a hand",
      ar: "حساب التوزيعة",
    },
    paragraphs: [
      {
        fr: "Contrat réussi : chaque équipe marque ses points, arrondis à la dizaine la plus proche. Contrat chuté : les attaquants marquent 0 et les défenseurs 160.",
        en: "Contract made: each team scores its points, rounded to the nearest ten. Contract failed: the attackers score 0 and the defenders 160.",
        ar: "كونترا ناجحة : كل فريق يسجل نقاطو، مقربين لأقرب عشرة. كونترا طايحة : المهاجمين ياخوا 0 والمدافعين 160.",
      },
      {
        fr: "En cas de contre, la donne vaut 320 points fixes ; sur-contre, 640 ; capot annoncé, 500. La Belote-Rebelote (+20) reste toujours acquise à son équipe.",
        en: "With a double, the hand is worth a fixed 320 points; a redouble, 640; an announced capot, 500. The Belote-Rebelote (+20) always stays with its team.",
        ar: "مع الكونتر، التوزيعة تسوى 320 نقطة ; السيركونتر 640 ; الكابو المعلن 500. البلوت-ربلوت (+20) ديما يقعدوا لفريقهم.",
      },
      {
        fr: "Le pli est ramassé par la carte la plus forte ; son gagnant ouvre le pli suivant. Le dernier pli rapporte les 10 points du « 10 de der ».",
        en: "The strongest card takes the trick; its winner leads the next one. The last trick earns the 10 bonus points of the “10 de der”.",
        ar: "أقوى كارطة هي اللي تلم اللعبة ; اللي ربحها يبدا اللعبة الجاية. آخر لعبة تجيب الـ10 نقاط متاع « 10 دي دار ».",
      },
    ],
  },
  {
    id: "tactics-bids",
    icon: "eye",
    title: {
      fr: "Tactique : lire les annonces",
      en: "Tactics: reading the bids",
      ar: "تكتيك : اقرا الآنونصات",
    },
    paragraphs: [
      {
        fr: "Une annonce de 90–100 dit en général : « J'ai le Valet d'atout et un peu de soutien. » Une annonce directe à 110 ou plus, ou un saut d'enchère, révèle un jeu très fort : Valet + 9, une belote, ou une couleur longue.",
        en: "A 90–100 bid usually says: “I have the Jack of trumps and some support.” A direct bid of 110 or more, or a jump bid, reveals a very strong hand: Jack + 9, a belote, or a long suit.",
        ar: "آنونص 90–100 معناتها في الغالب : « عندي فالاّ الأتو وشوية سند. » آنونص ديراكت بـ110 ولا أكثر، ولا نقزة في الآنونص، يوري لعبة قوية برشا : فالاّ + تسعة، بلوت، ولا لون طويل.",
      },
      {
        fr: "Quand ton partenaire annonce, son atout devient ton atout : soutiens-le si tu as des points (As, 10) dans les autres couleurs — chaque levée que tu apportes l'aide à passer son contrat.",
        en: "When your partner bids, their trump becomes your trump: support them if you hold points (Aces, 10s) in the other suits — every trick you bring helps them make the contract.",
        ar: "كي شريكك يعلن، الأتو متاعو يولي متاعك : سانده كان عندك نقاط (آصات، عشرات) في الألوان الأخرى — كل لعبة تجيبها تعاونو يسلّك الكونترا.",
      },
      {
        fr: "Un contre adverse signifie : « Je suis fort dans ton atout. » Méfie-toi et réévalue ton jeu avant de surenchérir.",
        en: "An opponent's double means: “I am strong in your trump.” Beware, and re-evaluate your hand before bidding higher.",
        ar: "كونتر من الخصم معناه : « أنا قوي في الأتو متاعك. » رد بالك وعاود قيّم لعبتك قبل ما تزيد تعلي.",
      },
    ],
    tip: {
      fr: "Passer est aussi une information : un joueur qui a passé puis coupe très vite est probablement court dans une couleur.",
      en: "Passing is information too: a player who passed and then cuts very early is probably short in a suit.",
      ar: "الباصي زادة معلومة : لاعب عمل باصي وبعد قص فيسع، غالباً ناقص في لون.",
    },
  },
  {
    id: "tactics-play",
    icon: "bulb",
    title: {
      fr: "Tactique : bien jouer ses cartes",
      en: "Tactics: playing your cards well",
      ar: "تكتيك : العب كروطك بالڨدا",
    },
    paragraphs: [
      {
        fr: "Attaquant : ouvre à l'atout (Valet puis 9) pour désarmer les défenseurs, puis encaisse tes As et tes 10 en toute sécurité.",
        en: "As attacker: lead trumps (Jack then 9) to disarm the defenders, then cash your Aces and 10s safely.",
        ar: "كي تكون مهاجم : ابدا بالأتو (الفالاّ وبعد التسعة) باش تنزع سلاح المدافعين، وبعد دخّل آصاتك وعشراتك بكل أمان.",
      },
      {
        fr: "Défenseur : garde tes atouts pour couper les couleurs où tu es court, et laisse ton partenaire prendre le pli quand il est maître — pense à la Tfaskira.",
        en: "As defender: keep your trumps to cut the suits you are short in, and let your partner take the trick when they are winning — think Tfaskira.",
        ar: "كي تكون مدافع : خلي الأتو متاعك باش تقص الألوان اللي إنت ناقص فيهم، وخلي شريكك ياخو اللعبة كي يكون مولى — تفكر التفسكيرة.",
      },
      {
        fr: "Compte les cartes ! Il existe 8 atouts : note combien sont déjà tombés. Sers-toi de tes défausses pour signaler tes couleurs fortes à ton partenaire.",
        en: "Count the cards! There are 8 trumps: keep track of how many have fallen. Use your discards to signal your strong suits to your partner.",
        ar: "احسب الكروط ! ثمة 8 أتوات : اعرف قداش طاحوا. واستعمل الرمي متاعك باش تعلم شريكك بالألوان القوية عندك.",
      },
    ],
    tip: {
      fr: "Le 10 sec (sans l'As) est fragile : joue-le sur un pli déjà maîtrisé par ton équipe.",
      en: "A bare 10 (without the Ace) is fragile: play it on a trick your team already controls.",
      ar: "العشرة وحدها (بلا آص) ضعيفة : العبها في لعبة فريقك مسيطر عليها.",
    },
  },
];
