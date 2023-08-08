import type { Metadata } from "next";
import { Cabin } from "next/font/google";
import "./globals.css";

const cabin = Cabin({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Alula",
	description: "just a silly bunny :3",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className={cabin.className}>{children}</body>
		</html>
	);
}
