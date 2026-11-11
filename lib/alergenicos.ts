/** Os 14 alergênicos que a lei do Reino Unido manda informar (Food Information Regulations 2014). */
export const ALERGENICOS = [
  { id: "gluten", nome: "Glúten", en: "Cereals containing gluten" },
  { id: "crustaceos", nome: "Crustáceos", en: "Crustaceans" },
  { id: "ovos", nome: "Ovos", en: "Eggs" },
  { id: "peixe", nome: "Peixe", en: "Fish" },
  { id: "amendoim", nome: "Amendoim", en: "Peanuts" },
  { id: "soja", nome: "Soja", en: "Soya" },
  { id: "leite", nome: "Leite", en: "Milk" },
  { id: "castanhas", nome: "Castanhas e nozes", en: "Tree nuts" },
  { id: "aipo", nome: "Aipo (salsão)", en: "Celery" },
  { id: "mostarda", nome: "Mostarda", en: "Mustard" },
  { id: "gergelim", nome: "Gergelim", en: "Sesame" },
  { id: "sulfitos", nome: "Sulfitos", en: "Sulphur dioxide / sulphites" },
  { id: "tremoco", nome: "Tremoço", en: "Lupin" },
  { id: "moluscos", nome: "Moluscos", en: "Molluscs" },
] as const;

export const IDS_ALERGENICOS: string[] = ALERGENICOS.map((a) => a.id);
export const nomeAlergenico = (id: string) => ALERGENICOS.find((a) => a.id === id)?.nome ?? id;
