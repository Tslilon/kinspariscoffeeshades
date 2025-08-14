export function Footer({ children }: React.PropsWithChildren<{}>) {
  return (
    <footer>
      <div className="details">
        {children}
      </div>
    </footer>
  );
}
