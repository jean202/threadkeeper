import { Html, Head, Main, NextScript } from 'next/document';

/** Only here to mark the pages as Korean, which is what every label is in. */
export default function Document() {
  return (
    <Html lang="ko">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
