import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type AppLinkProps = PropsWithChildren<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    navigate: (path: string) => void;
  }
>;

export function AppLink({ href, navigate, onClick, children, ...props }: AppLinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.altKey ||
          event.ctrlKey ||
          event.shiftKey ||
          props.target
        ) {
          return;
        }
        event.preventDefault();
        navigate(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
