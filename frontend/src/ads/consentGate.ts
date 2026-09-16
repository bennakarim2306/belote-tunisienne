// Coordinates startup native dialogs: the push-permission prompt must wait
// until the UMP (GDPR ads consent) flow has fully settled, so two native
// dialogs/activities never race each other (hard crash on some Android devices).
let resolveGate: (() => void) | null = null;
const gate = new Promise<void>((res) => {
  resolveGate = res;
});
// safety net: never block push registration for more than 20s
const timer = setTimeout(() => resolveGate?.(), 20000);

export function markConsentSettled() {
  clearTimeout(timer);
  resolveGate?.();
}

export const consentSettled = gate;
