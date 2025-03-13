import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import { CSPostHogProvider, GlobalStateProvider } from "./providers";
import { ClerkProvider } from '@clerk/nextjs'
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';


export const metadata: Metadata = {
  title: "GitPodcast",
  description:
    "Turn any GitHub repository into an engaging podcast in seconds.",
  metadataBase: new URL("https://gitpodcast.com"),
  keywords: [
    "github",
    "git podcast",
    "git podcast generator",
    "git podcast tool",
    "git podcast maker",
    "git podcast creator",
    "git podcast",
    "podcast",
    "repository",
    "visualization",
    "code structure",
    "system design",
    "software architecture",
    "software design",
    "software engineering",
    "software development",
    "software architecture",
    "software design",
    "software engineering",
    "software development",
    "open source",
    "open source software",
    "bandarlabs",
    "gitpodcast",
    "gitpodcast.com",
  ],
  authors: [
    { name: "", url: "https://github.com/BandarLabs" },
  ],
  creator: "BandarLabs",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://gitpodcast.com",
    title: "GitPodcast - Repository to Podcast in Seconds",
    description:
      "Turn any GitHub repository into an engaging podcast in seconds.",
    siteName: "GitPodcast",
    images: [
      {
        url: "/og-image.png?v=2", // You'll need to create this image
        width: 1200,
        height: 630,
        alt: "GitPodcast - Repository Podcaster Tool",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
        <ReactFlowProvider>
            <ClerkProvider>
                <GlobalStateProvider>
                    <CSPostHogProvider>
                        <body className="flex min-h-screen flex-col">
                        <Header />
                        <main className="flex-grow">{children}</main>
                        <Footer />
                        </body>
                    </CSPostHogProvider>
                </GlobalStateProvider>
            </ClerkProvider>
        </ReactFlowProvider>
    </html>
  );
}
