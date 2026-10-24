import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import MapView, { Marker, Region, MapHandle } from "../components/LocalMap";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFonts } from "expo-font";
import * as Crypto from "expo-crypto";
import { categories, priorities, Report, nearby } from "../domain/reports";
import {
  cities,
  cityAt,
  searchStreets,
  streetPoint,
  addressAt,
} from "../domain/catalog";
import { Point, distance } from "../domain/geo";
import {
  repository,
  locate,
  choosePhoto,
  Fix,
  loadTheme,
  saveTheme,
} from "../services/device";
import { palettes, resolveTheme, ThemePreference } from "../theme";

type Mode = "Mapa" | "Perto de mim" | "Acompanhando";
const region = (p: Point, delta = 0.025): Region => ({
  ...p,
  latitudeDelta: delta,
  longitudeDelta: delta,
});
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Não foi possível concluir. Tente novamente.";
export default function App() {
  useFonts(MaterialIcons.font);
  const system = useColorScheme(),
    [preference, setPreference] = useState<ThemePreference>("system");
  const theme = resolveTheme(preference, system),
    c = palettes[theme];
  const [rows, setRows] = useState<readonly Report[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [tab, setTab] = useState<Mode>("Mapa"),
    [cityId, setCityId] = useState(cities[0].id),
    [category, setCategory] = useState(-1);
  const [homeSelect, setHomeSelect] = useState<"city" | "category" | null>(
    null,
  );
  const [query, setQuery] = useState(""),
    [fix, setFix] = useState<Fix | null>(null),
    [radius, setRadius] = useState(3),
    [locating, setLocating] = useState(false);
  const [picker, setPicker] = useState<Point | null>(null),
    [draft, setDraft] = useState<Report | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [settings, setSettings] = useState(false),
    [saving, setSaving] = useState(false);
  const mainMap = useRef<MapHandle>(null),
    pickMap = useRef<MapHandle>(null),
    pickCenter = useRef<Point>(cities[0].center);
  const city = cities.find((x) => x.id === cityId)!;
  const refresh = () => setRows(repository.rows);
  async function load() {
    try {
      await repository.load();
      refresh();
      setLoaded(true);
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    void repository
      .load()
      .then(() => {
        setRows(repository.rows);
        setLoaded(true);
      })
      .catch((e) => setError(message(e)));
    void loadTheme()
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setPreference(v);
      })
      .catch(() => {});
  }, []);
  const visible = rows.filter(
    (r) => r.cityId === cityId && (category < 0 || r.category === category),
  );
  const list =
    tab === "Acompanhando"
      ? visible.filter((r) => r.following)
      : fix
        ? nearby(visible, fix.point, radius)
        : [];
  const detail = rows.find((r) => r.id === selected);
  const color = (r: Report) =>
    r.status === "Concluída"
      ? c.success
      : r.priority === "Alta"
        ? c.danger
        : r.priority === "Média"
          ? c.warning
          : c.primary;
  const text = (value: string, style: object = {}) => (
    <Text style={[{ color: c.text, fontSize: 15 }, style]}>{value}</Text>
  );
  const button = (
    label: string,
    action: () => void,
    icon?: React.ComponentProps<typeof MaterialIcons>["name"],
    active = false,
    disabled = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={action}
      style={[
        s.button,
        {
          backgroundColor: active ? c.primary : c.surface,
          borderColor: c.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={21}
          color={active ? c.onPrimary : c.primary}
        />
      )}
      <Text style={{ color: active ? c.onPrimary : c.text, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
  const input = (
    value: string,
    onChangeText: (v: string) => void,
    placeholder: string,
    multiline = false,
  ) => (
    <TextInput
      accessibilityLabel={placeholder}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.secondary}
      multiline={multiline}
      style={[
        s.input,
        {
          color: c.text,
          borderColor: c.border,
          backgroundColor: c.surface,
          minHeight: multiline ? 96 : 48,
          textAlignVertical: multiline ? "top" : "center",
        },
      ]}
    />
  );
  function openPicker(p = city.center) {
    pickCenter.current = p;
    setPicker(p);
    setQuery("");
  }
  async function gps(forReport = false) {
    setLocating(true);
    try {
      const position = await locate();
      setFix(position);
      const found = cityAt(position.point);
      if (found) setCityId(found.id);
      if (forReport) {
        if (!found)
          Alert.alert(
            "Fora da área atendida",
            "Escolha um ponto em Navegantes, Itajaí ou Balneário Camboriú.",
          );
        openPicker(found ? position.point : city.center);
      } else if (found)
        mainMap.current?.animateToRegion(region(position.point));
      else
        Alert.alert(
          "Fora da área atendida",
          "Você pode criar relatos escolhendo um ponto manualmente no mapa.",
        );
    } catch (e) {
      Alert.alert("Localização", message(e));
    } finally {
      setLocating(false);
    }
  }
  async function confirmPoint() {
    const camera = await pickMap.current?.getCamera();
    const p = camera?.center ?? pickCenter.current,
      found = cityAt(p);
    if (!found) {
      Alert.alert(
        "Ponto fora da cobertura",
        "Posicione o pin em Navegantes, Itajaí ou Balneário Camboriú.",
      );
      return;
    }
    const now = Date.now();
    setDraft({
      id: Crypto.randomUUID(),
      title: "",
      address: addressAt(p),
      cityId: found.id,
      description: "",
      category: category < 0 ? 0 : category,
      point: p,
      created: now,
      status: "Aberta",
      priority: "Média",
      photo: "",
      votes: 0,
      following: true,
      supported: false,
      demo: false,
      history: [
        {
          time: now,
          text: "Relato criado neste aparelho. Sem envio à prefeitura.",
        },
      ],
    });
    setPicker(null);
    setQuery("");
  }
  async function save() {
    if (!draft) return;
    if (
      draft.title.trim().length < 3 ||
      draft.description.trim().length < 5 ||
      !draft.address.trim()
    ) {
      Alert.alert(
        "Complete o relato",
        "Informe título (3 caracteres), descrição (5 caracteres) e endereço.",
      );
      return;
    }
    setSaving(true);
    try {
      await repository.save({
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
        address: draft.address.trim(),
      });
      refresh();
      setCityId(draft.cityId);
      setSelected(draft.id);
      setDraft(null);
    } catch (e) {
      Alert.alert("Relato não salvo", message(e));
    } finally {
      setSaving(false);
    }
  }
  async function mutate(action: () => Promise<void>) {
    if (saving) return;
    setSaving(true);
    try {
      await action();
      refresh();
    } catch (e) {
      Alert.alert("Alteração não salva", message(e));
    } finally {
      setSaving(false);
    }
  }
  const search = (picking = false) => (
    <View style={{ gap: 4 }}>
      {input(query, setQuery, "Buscar rua na cidade")}
      {query.trim().length >= 2 && (
        <View style={{ backgroundColor: c.surface, borderRadius: 12 }}>
          {searchStreets(query, cityId).map((street) => (
            <Pressable
              key={street.cityId + street.name}
              accessibilityRole="button"
              onPress={() => {
                const p = streetPoint(
                  street,
                  picking ? pickCenter.current : city.center,
                );
                if (picking) {
                  pickCenter.current = p;
                  pickMap.current?.animateToRegion(region(p, 0.008));
                } else mainMap.current?.animateToRegion(region(p, 0.008));
                setQuery("");
              }}
              style={{ padding: 12 }}
            >
              {text(street.name)}
            </Pressable>
          ))}
          {searchStreets(query, cityId).length === 0 &&
            text("Nenhuma rua encontrada", { padding: 12, color: c.secondary })}
        </View>
      )}
    </View>
  );
  const cityButtons = (picking = false) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      {cities.map((item) =>
        button(
          item.name,
          () => {
            setCityId(item.id);
            setQuery("");
            if (picking) {
              pickCenter.current = item.center;
              pickMap.current?.animateToRegion(region(item.center));
            } else mainMap.current?.animateToRegion(region(item.center));
          },
          undefined,
          item.id === cityId,
        ),
      )}
    </ScrollView>
  );
  const mapProps = { userInterfaceStyle: theme, userLocation: fix?.point };
  const card = (r: Report) => (
    <Pressable
      accessibilityRole="button"
      key={r.id}
      onPress={() => setSelected(r.id)}
      style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={s.row}>
        <MaterialIcons
          name={categories[r.category].icon}
          size={28}
          color={color(r)}
        />
        <View style={{ flex: 1 }}>
          {text(r.title, { fontWeight: "700", fontSize: 16 })}
          {text(r.address, { color: c.secondary, marginTop: 4 })}
        </View>
      </View>
      {text(
        `${r.status} · ${r.priority} · ${r.votes} apoios${r.demo ? " · EXEMPLO" : ""}`,
        { color: c.secondary, fontSize: 12, marginTop: 10 },
      )}
      {fix &&
        text(`${(distance(fix.point, r.point) / 1000).toFixed(1)} km`, {
          color: c.primary,
          marginTop: 6,
        })}
    </Pressable>
  );
  if (!loaded)
    return (
      <>
        <SafeAreaView
          style={[
            s.full,
            {
              backgroundColor: c.background,
              justifyContent: "center",
              padding: 24,
            },
          ]}
        >
          {error ? (
            <>
              {text(error)}
              {button("Tentar novamente", () => {
                setError("");
                void load();
              })}
            </>
          ) : (
            <ActivityIndicator color={c.primary} />
          )}
        </SafeAreaView>
      </>
    );
  return (
    <>
      <SafeAreaView style={[s.full, { backgroundColor: c.background }]}>
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
        <View style={s.header}>
          <View>
            {text("Zelo", {
              fontSize: 28,
              fontWeight: "800",
              color: c.primary,
            })}
            {text("Cuidar da cidade começa com você", {
              fontSize: 12,
              color: c.secondary,
            })}
          </View>
          {button("Tema", () => setSettings(true), "contrast")}
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 12 }}>
          {tab === "Mapa" && search()}
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Selecionar cidade: ${city.name}`}
              accessibilityState={{ expanded: homeSelect === "city" }}
              onPress={() => setHomeSelect("city")}
              style={[
                s.select,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: c.text, fontSize: 15 }}
              >
                {city.name}
              </Text>
              <MaterialIcons name="expand-more" size={24} color={c.secondary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Selecionar categoria: ${category < 0 ? "Todas" : categories[category].name}`}
              accessibilityState={{ expanded: homeSelect === "category" }}
              onPress={() => setHomeSelect("category")}
              style={[
                s.select,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: c.text, fontSize: 15 }}
              >
                {category < 0 ? "Categorias" : categories[category].name}
              </Text>
              <MaterialIcons name="expand-more" size={24} color={c.secondary} />
            </Pressable>
          </View>
        </View>
        {tab === "Mapa" ? (
          <View style={s.full}>
            {
              <MapView
                ref={mainMap}
                {...mapProps}
                style={s.full}
                initialRegion={region(city.center)}
                onLongPress={(e) => openPicker(e.nativeEvent.coordinate)}
              >
                {visible.map((r) => (
                  <Marker
                    key={`${r.id}-${theme}`}
                    coordinate={r.point}
                    onPress={() => setSelected(r.id)}
                  >
                    <View
                      accessibilityLabel={categories[r.category].name}
                      style={[s.marker, { backgroundColor: color(r) }]}
                    >
                      <MaterialIcons
                        name={categories[r.category].icon}
                        size={24}
                        color={theme === "dark" ? "#202124" : "#FFFFFF"}
                      />
                    </View>
                  </Marker>
                ))}
              </MapView>
            }
            <View style={{ padding: 12, gap: 8, backgroundColor: c.surface }}>
              <View style={s.wrap}>
                {button(
                  "Escolher ponto no mapa",
                  () => openPicker(),
                  "add-location-alt",
                  true,
                  false,
                )}
                {button(
                  locating ? "Buscando…" : "GPS",
                  () => void gps(true),
                  "my-location",
                  false,
                  locating || false,
                )}
              </View>
              {text(
                "Relatos locais · exemplos identificados · sem envio à prefeitura",
                { fontSize: 11, color: c.secondary },
              )}
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {tab === "Perto de mim" && (
              <>
                {button(
                  locating
                    ? "Buscando posição…"
                    : "Atualizar minha localização",
                  () => void gps(),
                  "my-location",
                  true,
                  locating,
                )}
                <View style={s.row}>
                  {[1, 3, 5].map((n) => (
                    <React.Fragment key={n}>
                      {button(
                        `${n} km`,
                        () => setRadius(n),
                        undefined,
                        radius === n,
                      )}
                    </React.Fragment>
                  ))}
                </View>
                {text(
                  fix
                    ? `Posição obtida às ${new Date(fix.timestamp).toLocaleTimeString("pt-BR")}. Atualize se mudar de local.`
                    : "Permita a localização para ver relatos próximos.",
                  { color: c.secondary },
                )}
              </>
            )}
            {list.map(card)}
            {list.length === 0 &&
              text(
                tab === "Acompanhando"
                  ? "Você ainda não acompanha relatos nesta cidade e categoria."
                  : "Nenhum relato próximo nesta cidade e categoria.",
                { color: c.secondary },
              )}
          </ScrollView>
        )}
        <View
          style={[s.nav, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          {(["Mapa", "Perto de mim", "Acompanhando"] as Mode[]).map(
            (mode, i) => (
              <Pressable
                key={mode}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === mode }}
                onPress={() => {
                  setTab(mode);
                  setQuery("");
                }}
                style={s.navItem}
              >
                <MaterialIcons
                  name={(["map", "near-me", "bookmark-outline"] as const)[i]}
                  size={25}
                  color={tab === mode ? c.primary : c.secondary}
                />
                {text(mode, {
                  fontSize: 12,
                  color: tab === mode ? c.primary : c.secondary,
                })}
              </Pressable>
            ),
          )}
        </View>
        <Modal
          visible={!!picker}
          animationType="slide"
          onRequestClose={() => setPicker(null)}
        >
          <SafeAreaView style={[s.full, { backgroundColor: c.background }]}>
            <View style={s.header}>
              {text("Posicione o pin", { fontSize: 21, fontWeight: "700" })}
              {button("Voltar", () => setPicker(null), "close")}
            </View>
            <View style={{ padding: 12, gap: 10 }}>
              {cityButtons(true)}
              {search(true)}
              {text(
                "Arraste o mapa até o local do problema. O GPS é opcional.",
                { color: c.secondary },
              )}
            </View>
            <View style={s.full}>
              {picker && (
                <MapView
                  ref={pickMap}
                  {...mapProps}
                  style={s.full}
                  initialRegion={region(picker, 0.012)}
                  onRegionChangeComplete={(r) => {
                    pickCenter.current = {
                      latitude: r.latitude,
                      longitude: r.longitude,
                    };
                  }}
                />
              )}
              <View pointerEvents="none" style={s.centerPin}>
                <MaterialIcons name="location-pin" size={48} color={c.danger} />
              </View>
            </View>
            <View style={{ padding: 16 }}>
              {button(
                "Confirmar este ponto",
                () => {
                  void confirmPoint().catch((e) =>
                    Alert.alert("Mapa", message(e)),
                  );
                },
                "check",
                true,
              )}
            </View>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={!!draft}
          animationType="slide"
          onRequestClose={() => {
            if (!saving) setDraft(null);
          }}
        >
          <SafeAreaView style={[s.full, { backgroundColor: c.background }]}>
            <KeyboardAvoidingView
              style={s.full}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={s.header}>
                {text("Novo relato", { fontSize: 22, fontWeight: "700" })}
                {button(
                  "Cancelar",
                  () => setDraft(null),
                  undefined,
                  false,
                  saving,
                )}
              </View>
              {draft && (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ padding: 16, gap: 14 }}
                >
                  {text("Categoria", { fontWeight: "700" })}
                  <View style={s.wrap}>
                    {categories.map((item, i) => (
                      <React.Fragment key={item.name}>
                        {button(
                          item.name,
                          () => setDraft({ ...draft, category: i }),
                          item.icon,
                          draft.category === i,
                          saving,
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                  {input(
                    draft.title,
                    (v) => setDraft({ ...draft, title: v }),
                    "Título do problema",
                  )}
                  {input(
                    draft.address,
                    (v) => setDraft({ ...draft, address: v }),
                    "Endereço e referência",
                  )}
                  {text(
                    `Pin: ${draft.point.latitude.toFixed(5)}, ${draft.point.longitude.toFixed(5)}`,
                    { color: c.secondary, fontSize: 12 },
                  )}
                  {input(
                    draft.description,
                    (v) => setDraft({ ...draft, description: v }),
                    "Descreva o que aconteceu",
                    true,
                  )}
                  {text("Prioridade", { fontWeight: "700" })}
                  <View style={s.row}>
                    {priorities.map((p) => (
                      <React.Fragment key={p}>
                        {button(
                          p,
                          () => setDraft({ ...draft, priority: p }),
                          undefined,
                          draft.priority === p,
                          saving,
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                  {button(
                    "Adicionar foto",
                    () => {
                      void choosePhoto()
                        .then((photo) => {
                          if (photo)
                            setDraft((current) =>
                              current ? { ...current, photo } : null,
                            );
                        })
                        .catch((e) => Alert.alert("Foto", message(e)));
                    },
                    "add-photo-alternate",
                    false,
                    saving,
                  )}
                  {draft.photo && (
                    <Image source={{ uri: draft.photo }} style={s.photo} />
                  )}
                  {text(
                    "Salvo apenas neste aparelho. Nenhum envio à prefeitura.",
                    { color: c.secondary, fontSize: 12 },
                  )}
                  {button(
                    saving ? "Salvando…" : "Salvar relato",
                    () => void save(),
                    "check",
                    true,
                    saving,
                  )}
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={!!detail}
          animationType="slide"
          onRequestClose={() => setSelected(null)}
        >
          <SafeAreaView style={[s.full, { backgroundColor: c.background }]}>
            <View style={s.header}>
              {text("Detalhes do relato", { fontSize: 21, fontWeight: "700" })}
              {button("Fechar", () => setSelected(null), "close")}
            </View>
            {detail && (
              <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                <MaterialIcons
                  name={categories[detail.category].icon}
                  size={44}
                  color={color(detail)}
                />
                {text(detail.title, { fontSize: 24, fontWeight: "700" })}
                {detail.demo &&
                  text("EXEMPLO ILUSTRATIVO", {
                    color: c.warning,
                    fontWeight: "700",
                  })}
                {text(detail.address, { color: c.secondary })}
                {text(
                  `${categories[detail.category].name} · ${detail.priority} · ${detail.status}`,
                )}
                {text(detail.description)}
                {detail.photo && (
                  <Image source={{ uri: detail.photo }} style={s.photo} />
                )}
                <View style={s.wrap}>
                  {button(
                    detail.following ? "Acompanhando" : "Acompanhar",
                    () => void mutate(() => repository.follow(detail.id)),
                    "bookmark-outline",
                    detail.following,
                    saving,
                  )}
                  {button(
                    `${detail.supported ? "Apoiado" : "Apoiar"} · ${detail.votes}`,
                    () => void mutate(() => repository.support(detail.id)),
                    "thumb-up-off-alt",
                    detail.supported,
                    saving,
                  )}
                </View>
                {text("Histórico", { fontSize: 18, fontWeight: "700" })}
                {detail.history.map((h, i) => (
                  <View key={i}>
                    {text(new Date(h.time).toLocaleString("pt-BR"), {
                      fontSize: 12,
                      color: c.secondary,
                    })}
                    {text(h.text)}
                  </View>
                ))}
                {text(
                  "Protótipo local. Apoios e acompanhamento ficam neste aparelho.",
                  { color: c.secondary, fontSize: 12 },
                )}
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
        <Modal
          visible={homeSelect !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setHomeSelect(null)}
        >
          <View style={s.scrim}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityLabel="Fechar seleção"
              onPress={() => setHomeSelect(null)}
            />
            <View
              style={[
                s.dialog,
                { backgroundColor: c.surface, maxHeight: "80%" },
              ]}
            >
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  {text(
                    homeSelect === "city"
                      ? "Selecionar cidade"
                      : "Selecionar categoria",
                    { fontSize: 20, fontWeight: "700" },
                  )}
                </View>
                {button("Fechar", () => setHomeSelect(null), "close")}
              </View>
              <ScrollView>
                {(homeSelect === "city"
                  ? cities.map((item) => ({
                      id: item.id,
                      name: item.name,
                      icon: "location-city" as const,
                    }))
                  : [
                      {
                        id: "-1",
                        name: "Todas as categorias",
                        icon: "apps" as const,
                      },
                      ...categories.map((item, i) => ({
                        id: String(i),
                        ...item,
                      })),
                    ]
                ).map((item) => {
                  const active =
                    homeSelect === "city"
                      ? item.id === cityId
                      : Number(item.id) === category;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => {
                        if (homeSelect === "city") {
                          const next = cities.find((x) => x.id === item.id)!;
                          setCityId(next.id);
                          setQuery("");
                          mainMap.current?.animateToRegion(region(next.center));
                        } else setCategory(Number(item.id));
                        setHomeSelect(null);
                      }}
                      style={[
                        s.option,
                        { backgroundColor: active ? c.primarySoft : c.surface },
                      ]}
                    >
                      <MaterialIcons
                        name={item.icon}
                        size={24}
                        color={active ? c.primary : c.secondary}
                      />
                      <View style={{ flex: 1 }}>
                        {text(item.name, {
                          color: active ? c.primary : c.text,
                        })}
                      </View>
                      <MaterialIcons
                        name={
                          active
                            ? "radio-button-checked"
                            : "radio-button-unchecked"
                        }
                        size={22}
                        color={active ? c.primary : c.secondary}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal
          visible={settings}
          transparent
          animationType="fade"
          onRequestClose={() => setSettings(false)}
        >
          <View style={s.scrim}>
            <View style={[s.dialog, { backgroundColor: c.surface }]}>
              {text("Aparência", { fontSize: 23, fontWeight: "700" })}
              {(["system", "light", "dark"] as const).map((v, i) => (
                <React.Fragment key={v}>
                  {button(
                    ["Usar tema do sistema", "Claro", "Escuro"][i],
                    () => {
                      void saveTheme(v)
                        .then(() => setPreference(v))
                        .catch((e) =>
                          Alert.alert("Tema não salvo", message(e)),
                        );
                    },
                    (
                      [
                        "settings-brightness",
                        "light-mode",
                        "dark-mode",
                      ] as const
                    )[i],
                    preference === v,
                  )}
                </React.Fragment>
              ))}
              {button("Concluir", () => setSettings(false))}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}
const s = StyleSheet.create({
  full: { flex: 1 },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  select: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  option: {
    minHeight: 52,
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, fontSize: 15 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16 },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  search: { position: "absolute", top: 12, left: 16, right: 16 },
  missing: {
    flex: 1,
    padding: 28,
    paddingTop: 110,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  nav: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 12 },
  navItem: { flex: 1, alignItems: "center", gap: 4, minHeight: 44 },
  centerPin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -24,
    marginTop: -48,
  },
  photo: { width: "100%", height: 220, borderRadius: 16 },
  scrim: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  dialog: { borderRadius: 24, padding: 24, gap: 14 },
});
