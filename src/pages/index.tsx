import { Box, Button, Center, Link, Text } from "@chakra-ui/react";
import React, { useState } from "react";
import logo from "../images/logo.svg";
import { Image } from "../theme";

export const Index = () => {
  const [count, setCount] = useState(0);

  return (
    <Box textAlign="center">
      <Center bg="background" minH="100vh" flexDir="column">
        <Image
          src={logo}
          alt="logo"
          h="40vmin"
          pointerEvents="none"
          animate={{ rotate: 360 }}
          transition={{
            duration: 3,
            ease: "linear",
            repeat: Infinity,
          }}
        />
        <Text>Hello Vite + React!</Text>
        <Button onClick={() => setCount((count) => count + 1)}>
          count is: {count}
        </Button>
        <Text>
          Edit <code>App.tsx</code> and save to test HMR updates.
        </Text>
        <Text>
          <Link color="brand.300" href="https://reactjs.org" isExternal>
            Learn React
          </Link>
          {" | "}
          <Link
            color="brand.300"
            href="https://vitejs.dev/guide/features.html"
            isExternal
          >
            Vite Docs
          </Link>
        </Text>
      </Center>
    </Box>
  );
};
