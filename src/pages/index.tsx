import { Box, Button, Center, Link, Text } from "@chakra-ui/react";
import React, { useState } from "react";
import logo from "../images/logo.svg";
import { Image } from "../theme";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  useQuery,
  gql,
} from "@apollo/client";
import { GetUser } from "./__generated__/GetUser";

const client = new ApolloClient({
  uri: "https://api.github.com/graphql",
  cache: new InMemoryCache(),
  headers: {
    Authorization: `Bearer ${
      import.meta.env.VITE_GITHUB_PERSONAL_ACCESS_TOKEN
    }`,
  },
});

export const Index = () => {
  return (
    <ApolloProvider client={client}>
      <IndexInner />
    </ApolloProvider>
  );
};

const IndexInner = () => {
  const [count, setCount] = useState(0);
  const { data } = useQuery<GetUser>(gql`
    query GetUser {
      user(login: "ishowta") {
        name
        company
        createdAt
      }
    }
  `);

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
        <Text>User: {data?.user?.name ?? "・・・"}</Text>
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
