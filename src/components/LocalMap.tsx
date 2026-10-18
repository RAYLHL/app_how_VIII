import React, {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { cities, streets } from "../domain/catalog";
import { Point } from "../domain/geo";
import {
  Camera,
  project,
  unproject,
  moveCamera,
  clampScale,
} from "../domain/map";
export type Region = Point & { latitudeDelta: number; longitudeDelta: number };
export type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  initialRegion: Region;
  userInterfaceStyle?: "light" | "dark";
  userLocation?: Point;
  onLongPress?: (event: { nativeEvent: { coordinate: Point } }) => void;
  onRegionChangeComplete?: (r: Region) => void;
  children?: React.ReactNode;
};
export type MapHandle = {
  animateToRegion: (r: Region) => void;
  getCamera: () => Promise<{ center: Point }>;
};
type MarkerProps = {
  coordinate: Point;
  onPress?: () => void;
  children?: React.ReactNode;
};
export function Marker(_props: MarkerProps) {
  return null;
}
const roads = streets.map((s) => ({
  ...s,
  bounds: {
    minLat: Math.min(...s.points.map((p) => p.latitude)),
    maxLat: Math.max(...s.points.map((p) => p.latitude)),
    minLon: Math.min(...s.points.map((p) => p.longitude)),
    maxLon: Math.max(...s.points.map((p) => p.longitude)),
  },
}));
const major = (kind: string) =>
  /^(motorway|trunk|primary|secondary|tertiary)/.test(kind);
const walk = (kind: string) =>
  /footway|path|pedestrian|cycleway|corridor/.test(kind);
export const mapColors = {
  light: {
    water: "#C3E4F5",
    land: "#F3F1EC",
    border: "#DADCE0",
    road: "#FFFFFF",
    casing: "#D5D9DD",
    highway: "#FDE293",
    major: "#FFF4D3",
    text: "#5F6368",
    surface: "#FFFFFF",
  },
  dark: {
    water: "#193443",
    land: "#202124",
    border: "#5F6368",
    road: "#3C4043",
    casing: "#17181A",
    highway: "#806F46",
    major: "#505358",
    text: "#BDC1C6",
    surface: "#292A2D",
  },
};
export default forwardRef<MapHandle, MapViewProps>(
  function LocalMap(props, ref) {
    const [size, setSize] = useState({ width: 400, height: 600 });
    const [camera, setCamera] = useState<Camera>({
      center: {
        latitude: props.initialRegion.latitude,
        longitude: props.initialRegion.longitude,
      },
      scale: clampScale((props.initialRegion.latitudeDelta * 111320) / 600),
    });
    const current = useRef(camera);

    const callbacks = useRef(props);

    const dimensions = useRef(size);

    const base = useRef({ camera, x: 0, y: 0, distance: 0 });
    const root = useRef<React.ComponentRef<typeof View>>(null),
      timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const touching = useRef(false);
    useLayoutEffect(() => {
      current.current = camera;
      callbacks.current = props;
      dimensions.current = size;
    }, [camera, props, size]);
    const c = mapColors[props.userInterfaceStyle ?? "light"];
    const notify = useCallback(
      (next: Camera) =>
        callbacks.current.onRegionChangeComplete?.({
          ...next.center,
          latitudeDelta: (next.scale * dimensions.current.height) / 111320,
          longitudeDelta:
            (next.scale * dimensions.current.width) /
            (111320 * Math.cos((next.center.latitude * Math.PI) / 180)),
        }),
      [],
    );
    useImperativeHandle(
      ref,
      () => ({
        animateToRegion: (r) => {
          const next = {
            center: { latitude: r.latitude, longitude: r.longitude },
            scale: clampScale(
              (r.latitudeDelta * 111320) / dimensions.current.height,
            ),
          };
          current.current = next;
          setCamera(next);
          notify(next);
        },
        getCamera: async () => ({ center: { ...current.current.center } }),
      }),
      [notify],
    );
    const touch = (touches: readonly { pageX: number; pageY: number }[]) => {
      const a = touches[0],
        b = touches[1] ?? a;
      return {
        x: (a.pageX + b.pageX) / 2,
        y: (a.pageY + b.pageY) / 2,
        distance:
          touches.length > 1
            ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
            : 0,
      };
    };
    const clear = useCallback(() => {
      touching.current = false;
      clearTimeout(timer.current);
    }, []);
    useEffect(() => clear, [clear]);
    const responder = useMemo(
      () =>
        // PanResponder stores callbacks; refs are read only when a native gesture fires.
        // eslint-disable-next-line react-hooks/refs
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_e, g) =>
            Math.abs(g.dx) + Math.abs(g.dy) > 4 || g.numberActiveTouches > 1,
          onPanResponderGrant: (e) => {
            clear();
            base.current = {
              camera: current.current,
              ...touch(e.nativeEvent.touches),
            };
          },
          onPanResponderMove: (e) => {
            const p = touch(e.nativeEvent.touches),
              b = base.current;
            if (!!p.distance !== !!b.distance) {
              base.current = { camera: current.current, ...p };
              return;
            }
            const next = moveCamera(
              b.camera,
              p.x - b.x,
              p.y - b.y,
              b.distance && p.distance
                ? (b.camera.scale * b.distance) / p.distance
                : b.camera.scale,
            );
            current.current = next;
            setCamera(next);
          },
          onPanResponderRelease: () => notify(current.current),
          onPanResponderTerminate: () => notify(current.current),
        }),
      [clear, notify],
    );
    const geometry = useMemo(() => {
      const nw = unproject({ x: -100, y: -100 }, camera, size),
        se = unproject(
          { x: size.width + 100, y: size.height + 100 },
          camera,
          size,
        );
      const visible = roads.filter(
        (s) =>
          s.bounds.minLat <= nw.latitude &&
          s.bounds.maxLat >= se.latitude &&
          s.bounds.minLon <= se.longitude &&
          s.bounds.maxLon >= nw.longitude &&
          (camera.scale < 15 || major(s.kind)) &&
          (camera.scale < 5 || !walk(s.kind)),
      );
      const seen = new Set<string>(),
        cells = new Set<string>();
      const paths = visible
        .map((s) => {
          const points = s.points.map((p) => project(p, camera, size));
          const path = points
            .map(
              (p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
            )
            .join(" ");
          return { s, points, path };
        })
        .sort((a, b) => Number(major(a.s.kind)) - Number(major(b.s.kind)));
      const labels: { x: number; y: number; angle: number; name: string }[] =
        [];
      for (const { s, points } of [...paths].reverse()) {
        if (
          !s.name ||
          seen.has(s.cityId + s.name) ||
          walk(s.kind) ||
          labels.length >= 65
        )
          continue;
        let length = 0,
          a = points[0],
          b = a;
        for (let i = 1; i < points.length; i++) {
          const v = Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y,
          );
          if (v > length) {
            length = v;
            a = points[i - 1];
            b = points[i];
          }
        }
        const x = (a.x + b.x) / 2,
          y = (a.y + b.y) / 2,
          cell = Math.floor(x / 110) + "," + Math.floor(y / 65);
        if (
          length < Math.min(180, s.name.length * 5) ||
          x < 30 ||
          x > size.width - 30 ||
          y < 25 ||
          y > size.height - 25 ||
          cells.has(cell)
        )
          continue;
        let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        labels.push({ x, y, angle, name: s.name });
        seen.add(s.cityId + s.name);
        cells.add(cell);
      }
      const land = cities.map((city) => ({
        city,
        path: city.polygons
          .map((p) =>
            p
              .map(
                (r) =>
                  r
                    .map((point, i) => {
                      const v = project(point, camera, size);
                      return `${i ? "L" : "M"}${v.x.toFixed(1)},${v.y.toFixed(1)}`;
                    })
                    .join(" ") + "Z",
              )
              .join(" "),
          )
          .join(" "),
      }));
      const groups = [0, 1, 2, 3].map((kind) => ({
        kind,
        path: paths
          .filter(
            ({ s }) =>
              (/motorway|trunk/.test(s.kind)
                ? 3
                : major(s.kind)
                  ? 2
                  : walk(s.kind)
                    ? 0
                    : 1) === kind,
          )
          .map((p) => p.path)
          .join(" "),
      }));
      return { groups, labels, land };
    }, [camera, size]);
    function zoom(factor: number) {
      const next = {
        ...current.current,
        scale: clampScale(current.current.scale / factor),
      };
      current.current = next;
      setCamera(next);
      notify(next);
    }
    return (
      <View
        ref={root}
        style={[styles.map, { backgroundColor: c.water }, props.style]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width && height) setSize({ width, height });
        }}
        {...responder.panHandlers}
        onTouchStart={(e) => {
          clear();
          if (!callbacks.current.onLongPress) return;
          touching.current = true;
          const { pageX, pageY } = e.nativeEvent;
          root.current?.measureInWindow((x, y) => {
            if (!touching.current) return;
            timer.current = setTimeout(
              () =>
                callbacks.current.onLongPress?.({
                  nativeEvent: {
                    coordinate: unproject(
                      { x: pageX - x, y: pageY - y },
                      current.current,
                      dimensions.current,
                    ),
                  },
                }),
              600,
            );
          });
        }}
        onTouchMove={clear}
        onTouchEnd={clear}
      >
        <Svg width={size.width} height={size.height} pointerEvents="none">
          {geometry.land.map(({ city, path }) => (
            <Path
              key={city.id}
              d={path}
              fill={c.land}
              stroke={c.border}
              strokeWidth={1}
              fillRule="evenodd"
            />
          ))}
          {geometry.groups.map(({ kind, path }) => (
            <Path
              key={"case" + kind}
              d={path}
              fill="none"
              stroke={c.casing}
              strokeWidth={[1.5, 4, 7, 9][kind]}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {geometry.groups.map(({ kind, path }) => (
            <Path
              key={"road" + kind}
              d={path}
              fill="none"
              stroke={kind === 3 ? c.highway : kind === 2 ? c.major : c.road}
              strokeWidth={[1, 2.5, 5, 7][kind]}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={kind === 0 ? [2, 3] : undefined}
            />
          ))}
          {geometry.labels.map((l, i) => (
            <React.Fragment key={"l" + i}>
              <SvgText
                x={l.x}
                y={l.y}
                rotation={l.angle}
                origin={`${l.x},${l.y}`}
                textAnchor="middle"
                fontSize={11}
                stroke={c.land}
                strokeWidth={3}
                fill={c.text}
              >
                {l.name}
              </SvgText>
              <SvgText
                x={l.x}
                y={l.y}
                rotation={l.angle}
                origin={`${l.x},${l.y}`}
                textAnchor="middle"
                fontSize={11}
                fill={c.text}
              >
                {l.name}
              </SvgText>
            </React.Fragment>
          ))}
          {camera.scale > 8 &&
            cities.map((city) => {
              const p = project(city.center, camera, size);
              return (
                <SvgText
                  key={city.id}
                  x={p.x}
                  y={p.y}
                  fontSize={16}
                  fontWeight="600"
                  textAnchor="middle"
                  fill={c.text}
                >
                  {city.name}
                </SvgText>
              );
            })}
        </Svg>
        {React.Children.map(props.children, (child) => {
          if (!React.isValidElement<MarkerProps>(child)) return null;
          const p = project(child.props.coordinate, camera, size);
          if (
            p.x < -50 ||
            p.x > size.width + 50 ||
            p.y < -50 ||
            p.y > size.height + 50
          )
            return null;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir relato no mapa"
              onPress={child.props.onPress}
              style={[styles.marker, { left: p.x - 20, top: p.y - 20 }]}
            >
              {child.props.children}
            </Pressable>
          );
        })}
        {props.userLocation &&
          (() => {
            const p = project(props.userLocation, camera, size);
            return (
              <View
                pointerEvents="none"
                style={[styles.dot, { left: p.x - 7, top: p.y - 7 }]}
              />
            );
          })()}
        <View
          style={[
            styles.zoom,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {[1.5, 1 / 1.5].map((factor, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={i ? "Diminuir zoom" : "Aumentar zoom"}
              onPress={() => zoom(factor)}
              style={styles.zoomButton}
            >
              <MaterialIcons
                name={i ? "remove" : "add"}
                size={25}
                color={c.text}
              />
            </Pressable>
          ))}
        </View>
        <Text
          style={[
            styles.attribution,
            { color: c.text, backgroundColor: c.surface },
          ]}
        >
          © OpenStreetMap · IBGE
        </Text>
      </View>
    );
  },
);
const styles = StyleSheet.create({
  map: { overflow: "hidden" },
  marker: { position: "absolute", width: 40, height: 40 },
  dot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#1A73E8",
    borderColor: "#FFFFFF",
    borderWidth: 2,
  },
  zoom: {
    position: "absolute",
    bottom: 36,
    right: 12,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 3,
  },
  zoomButton: {
    width: 46,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  attribution: {
    position: "absolute",
    bottom: 5,
    left: 6,
    fontSize: 10,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
});
