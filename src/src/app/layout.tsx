import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AGL - 学习需求诊断',
  description: '智能学习需求诊断工具，帮助企业讲师从模糊需求中提取精准干预方案',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="bg-surface text-on-surface-high antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
