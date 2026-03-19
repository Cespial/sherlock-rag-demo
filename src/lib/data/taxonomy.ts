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

// Light-theme vertical colors (subtle tints for Apple aesthetic)
export const VERTICAL_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string; pill: string }
> = {
  "Crédito Digital": {
    bg: "bg-cyan-50/60",
    text: "text-cyan-700",
    border: "border-cyan-200/60",
    dot: "bg-cyan-500",
    pill: "bg-cyan-50 text-cyan-700",
  },
  Crowdfunding: {
    bg: "bg-violet-50/60",
    text: "text-violet-700",
    border: "border-violet-200/60",
    dot: "bg-violet-500",
    pill: "bg-violet-50 text-violet-700",
  },
  Factoring: {
    bg: "bg-amber-50/60",
    text: "text-amber-700",
    border: "border-amber-200/60",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700",
  },
  Insurtech: {
    bg: "bg-emerald-50/60",
    text: "text-emerald-700",
    border: "border-emerald-200/60",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700",
  },
  Neobancos: {
    bg: "bg-rose-50/60",
    text: "text-rose-700",
    border: "border-rose-200/60",
    dot: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700",
  },
  "Pagos Digitales": {
    bg: "bg-blue-50/60",
    text: "text-blue-700",
    border: "border-blue-200/60",
    dot: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700",
  },
  RegTech: {
    bg: "bg-orange-50/60",
    text: "text-orange-700",
    border: "border-orange-200/60",
    dot: "bg-orange-500",
    pill: "bg-orange-50 text-orange-700",
  },
  WealthTech: {
    bg: "bg-lime-50/60",
    text: "text-lime-700",
    border: "border-lime-200/60",
    dot: "bg-lime-500",
    pill: "bg-lime-50 text-lime-700",
  },
};

export const DEFAULT_VERTICAL_COLOR = {
  bg: "bg-gray-50/60",
  text: "text-gray-600",
  border: "border-gray-200/60",
  dot: "bg-gray-400",
  pill: "bg-gray-50 text-gray-600",
};

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
    text: "¿Cómo se protegen los datos en pagos digitales?",
    filters: { tema: "Pagos Digitales" },
  },
  {
    text: "¿Qué obligaciones RegTech tienen las Fintech?",
    filters: { tema: "RegTech" },
  },
];
