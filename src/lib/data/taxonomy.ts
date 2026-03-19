export const TEMAS = [
  "Crédito Digital",
  "Crowdfunding",
  "Factoring",
  "Insurtech",
  "Neobancos",
  "Pagos Digitales",
  "RegTech",
  "WealthTech",
] as const;

export const FILTRO_TIPOS = [
  "Extracto RC&M",
  "Ley",
  "Decreto",
  "Circular",
  "Resolución",
  "Concepto",
  "Sentencia",
] as const;

export const FILTRO_AUTORIDADES = [
  "Congreso",
  "SFC",
  "MinHacienda",
  "MinTIC",
  "URF",
  "Corte Constitucional",
  "Legislador",
] as const;

export interface ExampleQuery {
  text: string;
  filters?: {
    tema?: string;
    tipo?: string;
    autoridad?: string;
    ano?: string;
  };
}

export const EXAMPLE_QUERIES: ExampleQuery[] = [
  {
    text: "¿Qué es crowdfunding en Colombia y cómo está regulado?",
    filters: { tema: "Crowdfunding" },
  },
  {
    text: "¿Cuáles son los requisitos para operar como neobanco?",
    filters: { tema: "Neobancos" },
  },
  {
    text: "¿Qué normas regulan el factoring electrónico?",
    filters: { tema: "Factoring" },
  },
  {
    text: "¿Cómo se protegen los datos personales en pagos digitales?",
    filters: { tema: "Pagos Digitales" },
  },
  {
    text: "¿Qué obligaciones RegTech tienen las Fintech en Colombia?",
    filters: { tema: "RegTech" },
  },
];
