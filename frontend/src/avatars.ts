// Funny avatar catalogue. Custom purchasable avatars can be appended later.
export interface AvatarDef {
  id: string;
  name: string;
  seed: string;
  bg: string;
}

export const AVATARS: AvatarDef[] = [
  { id: "av1", name: "Si Brahim", seed: "Brahim", bg: "f4a261" },
  { id: "av2", name: "Tata Zakia", seed: "Zakia", bg: "e8c07d" },
  { id: "av3", name: "Chef Slim", seed: "Slim", bg: "a3b18a" },
  { id: "av4", name: "Docteur Hichem", seed: "Hichem", bg: "d4a373" },
  { id: "av5", name: "Fatma la Rusée", seed: "Fatma", bg: "ffd5b8" },
  { id: "av6", name: "Si Mongi", seed: "Mongi", bg: "81b29a" },
  { id: "av7", name: "Baya Baklawa", seed: "Baya", bg: "f2cc8f" },
  { id: "av8", name: "Hamma Turbo", seed: "Hamma", bg: "e07a5f" },
  { id: "av9", name: "Lella Zohra", seed: "Zohra", bg: "eab69f" },
  { id: "av10", name: "Farhat Fantasia", seed: "Farhat", bg: "b7b7a4" },
  { id: "av11", name: "Aziza Harissa", seed: "Aziza", bg: "ddbea9" },
  { id: "av12", name: "Mokhtar le Malin", seed: "Mokhtar", bg: "cb997e" },
];

export const avatarUrl = (id: string): string => {
  const av = AVATARS.find((a) => a.id === id) ?? AVATARS[0];
  return `https://api.dicebear.com/9.x/big-smile/png?seed=${av.seed}&backgroundColor=${av.bg}&size=160`;
};
