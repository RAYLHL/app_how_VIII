import { Point, validPoint, distance } from "./geo";
import { cityAt, cities, streets } from "./catalog";
export const categories = [
  { name: "Iluminação pública", icon: "lightbulb-outline" },
  { name: "Buraco na via", icon: "warning-amber" },
  { name: "Entulho", icon: "delete-outline" },
  { name: "Calçada", icon: "directions-walk" },
  { name: "Sinalização", icon: "traffic" },
  { name: "Obra parada", icon: "construction" },
  { name: "Alagamento", icon: "flood" },
  { name: "Esgoto a céu aberto", icon: "water-drop" },
  { name: "Outros", icon: "more-horiz" },
] as const;
export const priorities = ["Baixa", "Média", "Alta"] as const;
export type Priority = (typeof priorities)[number];
export type Report = {
  id: string;
  title: string;
  address: string;
  cityId: string;
  description: string;
  category: number;
  point: Point;
  created: number;
  status: "Aberta" | "Em andamento" | "Concluída";
  priority: Priority;
  photo: string;
  votes: number;
  following: boolean;
  supported: boolean;
  demo: boolean;
  history: { time: number; text: string }[];
};
export interface Storage {
  read(): Promise<string | null>;
  write(raw: string): Promise<void>;
}
export function validReport(r: Report) {
  return (
    !!r &&
    typeof r.id === "string" &&
    r.id.length > 0 &&
    !!r.point &&
    validPoint(r.point) &&
    cityAt(r.point)?.id === r.cityId &&
    Number.isInteger(r.category) &&
    r.category >= 0 &&
    r.category < categories.length &&
    typeof r.title === "string" &&
    r.title.trim().length >= 3 &&
    typeof r.address === "string" &&
    !!r.address.trim() &&
    typeof r.description === "string" &&
    r.description.trim().length >= 5 &&
    priorities.includes(r.priority) &&
    Number.isInteger(r.votes) &&
    r.votes >= 0 &&
    Number.isFinite(r.created) &&
    ["Aberta", "Em andamento", "Concluída"].includes(r.status) &&
    typeof r.photo === "string" &&
    typeof r.following === "boolean" &&
    typeof r.supported === "boolean" &&
    typeof r.demo === "boolean" &&
    Array.isArray(r.history) &&
    r.history.every(
      (h) => Number.isFinite(h.time) && typeof h.text === "string",
    )
  );
}
const DEMO_PREFIX = "DEMO-V2-";
const demoTitles = [
  ["Poste com lâmpada apagada", "Iluminação intermitente", "Trecho com pouca iluminação", "Luminária acesa durante o dia"],
  ["Buraco próximo ao cruzamento", "Asfalto danificado", "Desnível na pista", "Pavimento com vários buracos"],
  ["Entulho na margem da rua", "Resíduos de obra acumulados", "Descarte de móveis", "Lixo acumulado em terreno"],
  ["Calçada com piso quebrado", "Passagem de pedestres obstruída", "Calçada com desnível", "Trecho sem acessibilidade"],
  ["Placa de trânsito danificada", "Faixa de pedestres apagada", "Sinalização pouco visível", "Placa encoberta"],
  ["Obra sem atividade aparente", "Materiais de obra na passagem", "Área de obra sem proteção", "Intervenção viária incompleta"],
  ["Água acumulada após chuva", "Bueiro com escoamento bloqueado", "Trecho com alagamento", "Drenagem insuficiente"],
  ["Vazamento aparente de esgoto", "Água com odor na via", "Esgoto próximo à calçada", "Canal com despejo aparente"],
  ["Equipamento urbano danificado", "Banco de praça quebrado", "Lixeira pública danificada", "Necessidade de limpeza"],
];
export function seedReports(now = Date.now()): Report[] {
  return cities.flatMap((city) => {
    const used = new Set<string>();
    const candidates = streets.filter((street) => street.cityId === city.id)
      .flatMap((street) => {
        const point = street.points[Math.floor(street.points.length / 2)];
        if (!point || cityAt(point)?.id !== city.id) return [];
        const key = street.normalized;
        if (used.has(key)) return [];
        used.add(key);
        return [{ street, point }];
      }).sort((a, b) => a.street.name.localeCompare(b.street.name, "pt-BR"));
    return Array.from({ length: 36 }, (_, i): Report => {
      const { street, point } = candidates[Math.floor(i * candidates.length / 36)];
      const category = i % categories.length;
      const variant = Math.floor(i / categories.length);
      const created = now - (i + 1) * 5 * 3600000;
      const status = (["Aberta", "Aberta", "Em andamento", "Concluída"] as const)[(i + variant) % 4];
      return {
        id: DEMO_PREFIX + city.id + "-" + i,
        title: demoTitles[category][variant] + " · exemplo",
        address: street.name + " · " + city.name,
        cityId: city.id,
        description: "EXEMPLO FICTÍCIO: " + demoTitles[category][variant] + ". Registro criado apenas para demonstrar os recursos do Zelo. Não representa uma ocorrência real nem atendimento da prefeitura.",
        category, point, created, status,
        priority: priorities[(i + variant) % priorities.length],
        photo: "", votes: (i * 7 + variant * 3) % 43,
        following: false, supported: false, demo: true,
        history: [
          { time: created, text: "Exemplo fictício cadastrado para demonstração." },
          ...(status === "Aberta" ? [] : [{ time: created + 3600000, text: "Situação ilustrativa: " + status + ". Sem resposta oficial." }]),
        ],
      };
    });
  });
}
export class Reports {
  private data: Report[] = [];
  private queue: Promise<void> = Promise.resolve();
  constructor(private storage: Storage) {}
  get rows(): readonly Report[] {
    return this.data.map((r) => ({
      ...r,
      point: { ...r.point },
      history: r.history.map((h) => ({ ...h })),
    }));
  }
  async load() {
    const raw = await this.storage.read();
    if (raw === null) {
      const data = seedReports();
      if (!data.every(validReport)) throw Error("Base de exemplos inválida.");
      await this.storage.write(JSON.stringify(data));
      this.data = data;
    } else {
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data) || !data.every(validReport))
        throw Error("Os dados locais estão inválidos e foram preservados.");
      // Replace previous demo data once; retain every user-created report.
      if (!data.some((r) => r.demo && r.id.startsWith(DEMO_PREFIX))) {
        const next = [...data.filter((r) => !r.demo), ...seedReports()];
        if (!next.every(validReport)) throw Error("Base de exemplos inválida.");
        await this.storage.write(JSON.stringify(next));
        this.data = next;
      } else this.data = data;
    }
  }
  private change(fn: (rows: Report[]) => Report[]) {
    const task = this.queue.then(async () => {
      const next = fn([...this.data]);
      if (!next.every(validReport))
        throw Error("Relato inválido ou fora das três cidades.");
      await this.storage.write(JSON.stringify(next));
      this.data = next;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  save(report: Report) {
    return this.change((rows) => [
      report,
      ...rows.filter((r) => r.id !== report.id),
    ]);
  }
  follow(id: string) {
    return this.change((rows) =>
      rows.map((r) => (r.id === id ? { ...r, following: !r.following } : r)),
    );
  }
  support(id: string) {
    return this.change((rows) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              supported: !r.supported,
              votes: r.votes + (r.supported ? -1 : 1),
            }
          : r,
      ),
    );
  }
}
export function nearby(rows: readonly Report[], point: Point, radius: number) {
  return rows
    .filter((r) => distance(point, r.point) <= radius * 1000)
    .sort((a, b) => distance(point, a.point) - distance(point, b.point));
}
