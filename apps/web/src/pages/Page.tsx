interface PageProps {
  title: string;
  description: string;
}

export function Page({ title, description }: PageProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
