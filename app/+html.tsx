import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, viewport-fit=cover"
        />

        {/* Google Identity Services - Loaded in head as per Google's official documentation */}
        <script src="https://accounts.google.com/gsi/client" async defer />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* 
          Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode.
          This is inside a `dangerouslySetInnerHTML` so that this styling is rendered synchronously on the server.
        */}
        <style dangerouslySetInnerHTML={{ __html: criticalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Critical CSS to be inlined in the head of the document
// This prevents a flash of unstyled content (FOUC)
const criticalStyles = `
  /* Material Icons class styles - font loaded locally via expo-font */
  .material-icons {
    font-family: 'Material Icons';
    font-weight: normal;
    font-style: normal;
    font-size: 24px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
  }

  /* Basic app layout styles */
  html, body {
    background-color: #121212;
    color: #fff;
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  
  #root, #root > div {
    height: 100%;
  }

  /* Force immediate display of root element */
  #root {
    opacity: 1 !important;
    visibility: visible !important;
  }
  
  /* Pre-style the bottom bar to prevent it from flashing */
  .bottom-bar-placeholder {
    position: fixed;
    bottom: 15px;
    left: 15px;
    right: 15px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #1C1C1E;
    border-radius: 25px;
    height: 60px;
    padding: 0 15px;
    z-index: 1000;
  }
  
  .bottom-icon-placeholder {
    width: 50px;
    height: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .mic-button-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background-color: #121212;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;
