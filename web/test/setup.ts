import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { client } from '../src/generated/api/client.gen.ts'

// The SDK builds a Request from `baseUrl` + path. A browser resolves the
// relative '/api' against the page; Node's Request (used under jsdom) needs an
// absolute URL, so tests point the client at the jsdom origin.
client.setConfig({ baseUrl: `${window.location.origin}/api` })

// jsdom does not implement ResizeObserver, and Mantine/AppShell use it
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverStub,
    writable: true,
  })
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom does not implement FontFaceSet; Mantine Textarea autosize listens to
// document.fonts "loadingdone" to remeasure.
if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    writable: true,
    value: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  })
}

afterEach(() => {
  cleanup()
})
