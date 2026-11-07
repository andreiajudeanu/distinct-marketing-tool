import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Composition,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { WORDMARK_PATH } from "./brand";

type Props = Record<string, unknown>;

const calculateMetadata: CalculateMetadataFunction<Props> = () => ({});

loadFont({
  family: "Lexend",
  url: staticFile("lexend.woff2"),
  weight: "100 900",
});

const INK = "#221b3d";
const INK_SOFT = "#4b4470";
const AQUA = "#60e4d8";
const MARK_PATH =
  "M132 102h128c85 0 154 69 154 154s-69 154-154 154H132V102Zm66 66v176h60c49 0 88-39 88-88s-39-88-88-88h-60Z";

// Frame of the single sound in the film: the dot lands in the D.
export const DOT_LANDS = 46;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const settle = Easing.bezier(0.16, 1, 0.3, 1);

export const MyComposition = () => {
  return (
    <Composition
      id="Logo"
      component={Logo}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
    />
  );
};

const Mark: React.FC = () => {
  const frame = useCurrentFrame();

  const pop = interpolate(frame, [0, 18], [0.5, 1], {
    ...clamp,
    easing: Easing.spring({ damping: 12, mass: 0.7, stiffness: 120 }),
  });
  const appear = interpolate(frame, [0, 5], [0, 1], clamp);
  const landDip = interpolate(
    frame,
    [DOT_LANDS, DOT_LANDS + 3, DOT_LANDS + 12],
    [1, 0.965, 1],
    { ...clamp, easing: Easing.out(Easing.quad) },
  );

  const travel = interpolate(frame, [60, 82], [0, 1], {
    ...clamp,
    easing: settle,
  });
  const size = interpolate(travel, [0, 1], [380, 240]);
  const centreX = interpolate(travel, [0, 1], [960, 679]);
  const centreY = interpolate(travel, [0, 1], [500, 470]);
  const scale = (size / 512) * pop * landDip;

  const draw = interpolate(frame, [10, 32], [1, 0], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const fill = interpolate(frame, [27, 36], [0, 1], clamp);

  const dropY = interpolate(frame, [33, DOT_LANDS], [-430, 0], {
    ...clamp,
    easing: Easing.in(Easing.quad),
  });
  const dotShown = interpolate(frame, [33, 35], [0, 1], clamp);
  const squashX = interpolate(
    frame,
    [DOT_LANDS, DOT_LANDS + 3, DOT_LANDS + 9],
    [1, 1.22, 1],
    clamp,
  );
  const squashY = interpolate(
    frame,
    [DOT_LANDS, DOT_LANDS + 3, DOT_LANDS + 9],
    [1, 0.78, 1],
    clamp,
  );
  const ringRadius = interpolate(frame, [DOT_LANDS, DOT_LANDS + 18], [46, 150], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const ringOpacity = interpolate(
    frame,
    [DOT_LANDS - 1, DOT_LANDS, DOT_LANDS + 18],
    [0, 0.9, 0],
    clamp,
  );

  return (
    <g
      opacity={appear}
      transform={`translate(${centreX} ${centreY}) scale(${scale}) translate(-256 -256)`}
    >
      <rect width="512" height="512" rx="116" fill="url(#distinct-bg)" />
      <path
        d={MARK_PATH}
        fill="none"
        stroke="#ffffff"
        strokeWidth={7}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={draw}
      />
      <path d={MARK_PATH} fill="#ffffff" fillRule="evenodd" opacity={fill} />
      <circle
        cx="264"
        cy="256"
        r={ringRadius}
        fill="none"
        stroke={AQUA}
        strokeWidth={8}
        opacity={ringOpacity}
      />
      <g
        opacity={dotShown}
        transform={`translate(264 ${256 + dropY}) scale(${squashX} ${squashY})`}
      >
        <circle r="46" fill={AQUA} />
      </g>
    </g>
  );
};

const Wordmark: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [64, 86], [0, 1], {
    ...clamp,
    easing: settle,
  });
  const scale = 240 / 512;
  return (
    <g transform={`translate(559 350) scale(${scale})`}>
      <clipPath id="word-reveal">
        <rect x="560" y="-20" width={1160 * reveal} height="560" />
      </clipPath>
      <g clipPath="url(#word-reveal)">
        <path
          fill={INK}
          transform={`translate(${608 - 26 * (1 - reveal)} 364)`}
          d={WORDMARK_PATH}
        />
      </g>
    </g>
  );
};

const Tagline: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 660,
        textAlign: "center",
        fontFamily: "Lexend",
        fontSize: 52,
        fontWeight: 400,
        letterSpacing: "-0.01em",
        color: INK_SOFT,
        opacity: interpolate(frame, [86, 98], [0, 1], clamp),
        translate: interpolate(frame, [86, 100], ["0px 22px", "0px 0px"], {
          ...clamp,
          easing: settle,
        }),
      }}
    >
      See your market. Stand out.
    </div>
  );
};

export const Logo: React.FC<Props> = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(1500px 1000px at 50% 44%, #e4ebff 0%, #d3dfff 100%)",
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="distinct-bg" x1="0.12" y1="0" x2="0.88" y2="1">
            <stop offset="0" stopColor="#8a66fc" />
            <stop offset="1" stopColor="#6a45e8" />
          </linearGradient>
        </defs>
        <Wordmark />
        <Mark />
      </svg>
      <Tagline />
    </AbsoluteFill>
  );
};
