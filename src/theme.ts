import {
  extendTheme,
  Image as _Image,
  ImageProps,
  ThemeOverride,
} from "@chakra-ui/react";
import { motion, MotionProps } from "framer-motion";

const extension: ThemeOverride = {
  colors: {
    brand: {
      50: "#EDFDFD",
      100: "#C4F1F9",
      200: "#9DECF9",
      300: "#76E4F7",
      400: "#0BC5EA",
      500: "#00B5D8",
      600: "#00A3C4",
      700: "#0987A0",
      800: "#086F83",
      900: "#065666",
    },

    background: "#282c34",
  },
  components: {
    Text: {
      baseStyle: {
        fontSize: "2xl",
        color: "white",
      },
    },
  },
};

export const theme = extendTheme(extension);

export const Image = motion<Omit<ImageProps, keyof MotionProps>>(_Image);
