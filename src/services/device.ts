import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { File, Paths, Directory } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { AppState } from "react-native";
import { Reports } from "../domain/reports";
import { Point, usableFix } from "../domain/geo";
// Private JSON files keep persistence independent of the legacy bridge.
function readLocal(name: string): string | null {
  const file = new File(Paths.document, name);
  return file.exists ? file.textSync() : null;
}
function writeLocal(name: string, raw: string) {
  const pending = new File(Paths.document, ".pending-" + name);
  pending.create({ overwrite: true });
  pending.writeSync(raw);
  pending.moveSync(new File(Paths.document, name), { overwrite: true });
}
export const repository = new Reports({
  read: async () => readLocal("zelo-reports.json"),
  write: async (raw) => writeLocal("zelo-reports.json", raw),
});
export async function loadTheme() {
  return readLocal("zelo-theme.txt");
}
export async function saveTheme(value: string) {
  writeLocal("zelo-theme.txt", value);
}
export type Fix = { point: Point; accuracy: number | null; timestamp: number };
export async function locate(): Promise<Fix> {
  const granted = await Location.requestForegroundPermissionsAsync();
  if (!granted.granted)
    throw Error("Permissão negada. Você pode escolher o ponto manualmente.");
  if (!(await Location.hasServicesEnabledAsync()))
    throw Error("Ative a localização ou escolha o ponto no mapa.");
  return new Promise((resolve, reject) => {
    let finished = false;
    let subscription: Location.LocationSubscription | undefined;
    const lifecycle = AppState.addEventListener("change", (state) => {
      if (state !== "active")
        finish(
          undefined,
          Error("Localização cancelada ao sair do aplicativo."),
        );
    });
    const timer = setTimeout(
      () =>
        finish(
          undefined,
          Error(
            "Não foi possível obter uma posição precisa em 20 segundos. Escolha no mapa.",
          ),
        ),
      20000,
    );
    function finish(fix?: Fix, error?: Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      subscription?.remove();
      lifecycle.remove();
      if (fix) resolve(fix);
      else reject(error ?? Error("Posição indisponível."));
    }
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (position) => {
        const fix = {
          point: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        if (usableFix(fix)) finish(fix);
      },
    )
      .then((value) => {
        subscription = value;
        if (finished) value.remove();
      })
      .catch((e) => finish(undefined, e));
  });
}
export async function choosePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 20 * 1024 * 1024)
    throw Error("Escolha uma foto de até 20 MB.");
  const original = new File(asset.uri);
  if (original.size > 20 * 1024 * 1024)
    throw Error("Escolha uma foto de até 20 MB.");
  const directory = new Directory(Paths.document, "photos");
  directory.create({ idempotent: true, intermediates: true });
  const target = new File(directory, Crypto.randomUUID() + ".jpg");
  await original.copy(target);
  return target.uri;
}
