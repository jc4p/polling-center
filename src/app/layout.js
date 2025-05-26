import "./globals.css";
import { FrameInit } from "@/components/FrameInit";
import { AuthProvider } from "@/lib/auth";
import { Web3Provider } from "@/lib/web3Context";

export const metadata = {
  title: "Polling Center",
  description: "Onchain polling platform for Farcaster",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <Web3Provider>
            <div>
              {children}
              <FrameInit />
            </div>
          </Web3Provider>
        </AuthProvider>
      </body>
    </html>
  );
}
