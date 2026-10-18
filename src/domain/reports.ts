import { Point, validPoint, distance } from "./geo";
import { cityAt, cities, searchStreets, streetPoint } from "./catalog";
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
export function seedReports(now = Date.now()): Report[] {
  let n = 0;
  return cities.flatMap((city) =>
    searchStreets("rua", city.id)
      .slice(0, 3)
      .map((street) => {
        const category = n++ % categories.length;
        return {
          id: "EX-" + n,
          title: categories[category].name + " · exemplo",
          address: street.name + " · " + city.name,
          cityId: city.id,
          description:
            "Ocorrência fictícia para experimentar o aplicativo. Não é uma reclamação real.",
          category,
          point: streetPoint(street, city.center),
          created: now - n * 3600000,
          status: n % 3 === 0 ? "Em andamento" : "Aberta",
          priority: n % 3 === 0 ? "Alta" : "Média",
          photo: "",
          votes: n + 2,
          following: false,
          supported: false,
          demo: true,
          history: [
            {
              time: now - n * 3600000,
              text: "Exemplo ilustrativo. Sem resposta oficial.",
            },
          ],
        };
      }),
  );
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
      this.data = data;
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
