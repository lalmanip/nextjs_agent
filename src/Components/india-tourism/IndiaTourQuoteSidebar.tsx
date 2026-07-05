import IndiaTourQuoteForm from "./IndiaTourQuoteForm";

type IndiaTourQuoteSidebarProps = {
  destinationLabel: string;
  id?: string;
};

export default function IndiaTourQuoteSidebar({ destinationLabel, id }: IndiaTourQuoteSidebarProps) {
  return (
    <aside className="lg:sticky lg:top-[var(--india-page-header-offset)] lg:z-20 lg:max-h-[calc(100vh-var(--india-page-header-offset)-1rem)] lg:self-start">
      <IndiaTourQuoteForm destinationLabel={destinationLabel} id={id} sidebar />
    </aside>
  );
}
