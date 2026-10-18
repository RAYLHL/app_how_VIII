import { project, unproject, moveCamera, clampScale } from "../src/domain/map";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cities,
  cityAt,
  searchStreets,
  streetPoint,
} from "../src/domain/catalog";
import { distance, polygonContains, usableFix } from "../src/domain/geo";
import {
  Reports,
  seedReports,
  validReport,
  nearby,
} from "../src/domain/reports";
import { resolveTheme } from "../src/theme";
const point = (latitude: number, longitude: number) => ({
  latitude,
  longitude,
});
test("limites municipais, ruas e exemplos respeitam as três cidades", () => {
  for (const city of cities) {
    assert.equal(cityAt(city.center)?.id, city.id);
    const streets = searchStreets("rua", city.id);
    assert(streets.length > 0);
    for (const street of streets)
      assert.equal(cityAt(streetPoint(street, city.center))?.id, city.id);
  }
  assert.equal(cityAt(point(0, 0)), undefined);
  assert.equal(seedReports().length, 9);
  assert(seedReports().every(validReport));
});
test("polígono exclui buracos e inclui borda exterior", () => {
  const square = [
    point(0, 0),
    point(0, 4),
    point(4, 4),
    point(4, 0),
    point(0, 0),
  ];
  const hole = [
    point(1, 1),
    point(1, 2),
    point(2, 2),
    point(2, 1),
    point(1, 1),
  ];
  assert(polygonContains([square, hole], point(0, 2)));
  assert(!polygonContains([square, hole], point(1.5, 1.5)));
  assert(!polygonContains([square], point(8, 8)));
});
test("GPS rejeita posições antigas e imprecisas", () => {
  const now = 100000,
    fix = { point: point(-26.9, -48.6), accuracy: 10, timestamp: now };
  assert(usableFix(fix, now));
  assert(!usableFix({ ...fix, accuracy: 101 }, now));
  assert(!usableFix({ ...fix, timestamp: 0 }, now));
});
test("apoios concorrentes são serializados e falha de gravação não altera estado", async () => {
  let raw: string | null = null,
    fail = false;
  const store = new Reports({
    read: async () => raw,
    write: async (value) => {
      if (fail) throw Error("disco");
      raw = value;
    },
  });
  await store.load();
  const id = store.rows[0].id,
    n = store.rows[0].votes;
  await Promise.all([store.support(id), store.follow(id)]);
  assert.equal(store.rows[0].votes, n + 1);
  assert(store.rows[0].following);
  fail = true;
  await assert.rejects(store.support(id));
  assert.equal(store.rows[0].votes, n + 1);
  fail = false;
  await store.support(id);
  assert.equal(store.rows[0].votes, n);
  const restored = new Reports({
    read: async () => raw,
    write: async () => {},
  });
  await restored.load();
  assert.equal(restored.rows[0].votes, n);
});
test("dados inválidos são preservados sem recriar exemplos", async () => {
  const raw = "[null]";
  let writes = 0;
  const store = new Reports({
    read: async () => raw,
    write: async () => {
      writes++;
    },
  });
  await assert.rejects(store.load());
  assert.equal(writes, 0);
});
test("busca próxima usa distância real e ordena; tema segue preferência", () => {
  const rows = seedReports(),
    p = rows[0].point;
  const found = nearby(rows, p, 1);
  assert.equal(found[0].id, rows[0].id);
  assert(found.every((r) => distance(r.point, p) <= 1000));
  assert.equal(resolveTheme("system", "dark"), "dark");
  assert.equal(resolveTheme("light", "dark"), "light");
  assert.equal(resolveTheme("system", null), "light");
});

test("projeção e conversão inversa preservam o ponto em diferentes zooms", () => {
  for (const scale of [0.45, 7, 85]) {
    const camera = { center: cities[0].center, scale },
      size = { width: 390, height: 500 },
      p = point(-26.9, -48.64);
    const restored = unproject(project(p, camera, size), camera, size);
    assert(distance(p, restored) < 0.001);
  }
});
test("gestos movem no sentido correto e respeitam limites de escala e região", () => {
  const c = { center: cities[0].center, scale: 7 };
  const moved = moveCamera(c, 100, 100);
  assert(moved.center.longitude < c.center.longitude);
  assert(moved.center.latitude > c.center.latitude);
  assert.equal(clampScale(0.01), 0.45);
  assert.equal(clampScale(1000), 85);
  const edge = moveCamera(c, 1e9, 1e9);
  assert.equal(edge.center.latitude, -26.7);
  assert.equal(edge.center.longitude, -48.95);
});
