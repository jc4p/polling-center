import "./globals.css";
import { FrameInit } from "@/components/FrameInit";
import { AuthProvider } from "@/lib/auth";

export const metadata = {
  title: "Polling Center",
  description: "Onchain polling platform for Farcaster",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <div>
            {children}
            <FrameInit />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
