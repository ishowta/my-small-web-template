import React from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { Index } from './pages'
import { theme } from './theme'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

export const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Switch>
          <Route path="/">
            <Index />
          </Route>
        </Switch>
      </Router>
    </ChakraProvider>
  )
}
