/**
 * Sprint 2 norms: SFC Circulars, BanRep, DIAN, SIC, Supersociedades
 *
 * These are fetched from different sources than Sprint 1.
 * Many are PDFs or special HTML formats.
 * We use alternative sources when direct gov URLs are unavailable.
 */

import type { NormSource } from "./norm-sources";

export const SPRINT2_SOURCES: NormSource[] = [
  // ═══ SFC Circulars (via normativa pages or legal databases) ═══
  {
    id: "ce-007-2018-sfc",
    name: "CE 007 de 2018 SFC — Ciberseguridad",
    year: 2018,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10082584/circulareExterna00718.docx",
    type: "circular",
    temas: ["Ciberseguridad"],
    priority: 1,
  },
  {
    id: "ce-027-2020-sfc",
    name: "CE 027 de 2020 SFC — SARLAFT 4.0",
    year: 2020,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10100953/ce027_20.docx",
    type: "circular",
    temas: ["SARLAFT"],
    priority: 1,
  },
  {
    id: "ce-005-2019-sfc",
    name: "CE 005 de 2019 SFC — Cloud Computing",
    year: 2019,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10096652/ce005_19.docx",
    type: "circular",
    temas: ["Ciberseguridad", "RegTech"],
    priority: 1,
  },
  {
    id: "ce-004-2024-sfc",
    name: "CE 004 de 2024 SFC — Finanzas Abiertas",
    year: 2024,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10114895/ce004_24.pdf",
    type: "circular",
    temas: ["Open Banking"],
    priority: 1,
  },
  {
    id: "ce-014-2021-sfc",
    name: "CE 014 de 2021 SFC — Crowdfunding Instrucciones",
    year: 2021,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10105685/ce014_21.docx",
    type: "circular",
    temas: ["Crowdfunding"],
    priority: 1,
  },
  {
    id: "ce-016-2021-sfc",
    name: "CE 016 de 2021 SFC — Sandbox/Espacio Controlado",
    year: 2021,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10106124/ce016_21.docx",
    type: "circular",
    temas: ["Sandbox"],
    priority: 1,
  },
  {
    id: "ce-033-2020-sfc",
    name: "CE 033 de 2020 SFC — TUIC Incidentes Cibernéticos",
    year: 2020,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10102258/ce033_20.docx",
    type: "circular",
    temas: ["Ciberseguridad", "RegTech"],
    priority: 2,
  },
  {
    id: "ce-006-2019-sfc",
    name: "CE 006 de 2019 SFC — Pagos con Código QR",
    year: 2019,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10096810/ce006_19.docx",
    type: "circular",
    temas: ["Pagos Digitales"],
    priority: 2,
  },
  {
    id: "ce-029-2024-sfc",
    name: "CE 029 de 2024 SFC — Ciber-resiliencia",
    year: 2024,
    authority: "SFC",
    url: "https://www.superfinanciera.gov.co/descargas/institucional/publicaciones/10114895/ce029_24.pdf",
    type: "circular",
    temas: ["Ciberseguridad"],
    priority: 2,
  },

  // ═══ BanRep ═══
  {
    id: "res-ext-6-2023-banrep",
    name: "Resolución Externa 6 de 2023 BanRep — Pagos Inmediatos",
    year: 2023,
    authority: "Banco de la República",
    url: "https://www.banrep.gov.co/sites/default/files/reglamentacion/archivos/re_06_2023.pdf",
    type: "resolucion",
    temas: ["Pagos Digitales"],
    priority: 1,
  },

  // ═══ DIAN ═══
  {
    id: "res-042-2020-dian",
    name: "Resolución 042 de 2020 DIAN — RADIAN/Facturación Electrónica",
    year: 2020,
    authority: "DIAN",
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=111324",
    type: "resolucion",
    temas: ["Factoring"],
    priority: 2,
  },
];
