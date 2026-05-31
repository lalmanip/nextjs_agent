"use client";

interface TicketConfirmationProps {
  ticketDetails: any;
  pnr: string;
  appReference: string;
  domainToken?: string;
  onClose: () => void;
}

export default function TicketConfirmation({ ticketDetails, pnr, appReference, domainToken, onClose }: TicketConfirmationProps) {
  const normalizeTicketPdfId = (raw: string): string => {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    if (/^\d+$/.test(s)) return s;
    if (/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s)) return s;
    return "";
  };

  const extractBookingId = (obj: any): string => {
    if (obj == null) return "";
    const seen = new Set<any>();
    const stack: any[] = [obj];
    while (stack.length) {
      const v = stack.pop();
      if (v == null || typeof v !== "object") continue;
      if (seen.has(v)) continue;
      seen.add(v);
      if (Array.isArray(v)) {
        for (const x of v) stack.push(x);
        continue;
      }
      for (const [k, val] of Object.entries(v)) {
        if (/app_reference|appreference|bookingid|bookid|bookingref/i.test(k)) {
          const id = normalizeTicketPdfId(String(val ?? ""));
          if (id) return id;
        }
        stack.push(val);
      }
    }
    return "";
  };

  const pdfPathId = normalizeTicketPdfId(extractBookingId(ticketDetails)) || normalizeTicketPdfId(appReference);
  const pdfUrl = pdfPathId
    ? `/api/flight/ticket-pdf?app_reference=${encodeURIComponent(pdfPathId)}`
    : "";

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-green-600">Booking Confirmed!</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          {/* PNR Section */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-green-800">Your PNR</h3>
              <div className="text-3xl font-bold text-green-600 mt-2">{pnr}</div>
              <p className="text-sm text-green-700 mt-1">Please save this for your records</p>
            </div>
          </div>

          {/* PDF Ticket Display */}
          <div className="border rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">Your Ticket</h3>
            <div className="w-full h-96">
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0 rounded"
                  title="Flight Ticket PDF"
                />
              ) : (
                <p className="text-sm text-gray-600">Ticket PDF link unavailable — missing booking reference.</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary-dark font-semibold"
            >
              Close
            </button>
            <a
              href={pdfUrl || "#"}
              download={pdfPathId ? `ticket-${pdfPathId}.pdf` : undefined}
              className={`flex-1 border border-primary py-3 rounded-lg font-semibold text-center ${
                pdfUrl
                  ? "text-primary hover:bg-primary hover:text-white cursor-pointer"
                  : "text-gray-400 border-gray-200 pointer-events-none"
              }`}
              aria-disabled={!pdfUrl}
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}