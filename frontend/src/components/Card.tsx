import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  const classes = ["card", className].filter(Boolean).join(" ");
  return <section className={classes}>{children}</section>;
}
