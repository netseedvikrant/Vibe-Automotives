const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /\{isMatched \?\s*\([\s\S]*?item\.payment_status === 'Paid' \?\s*\([\s\S]*?<Icons\.Bell className="w-3\.5 h-3\.5"\/>\s*Notify Procurement\s*<\/button>\s*<\/div>\s*\)\s*:\s*\([\s\S]*?Notify Procurement \(Restricted\)\s*<\/button>\s*<\/div>\s*\)\s*\)\s*:\s*\([\s\S]*?Mismatch Block[\s\S]*?Notify Procurement \(Restricted\)\s*<\/button>\s*<\/div>\s*\)\s*\}/;

const replacement = \{item.payment_status === 'Paid' ? (
    <div className=\"flex gap-2 justify-end items-center\">
        <span className=\"text-xs font-black text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded shadow-sm\">
            ? Paid
        </span>
        <button
            className=\"px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors shadow flex items-center gap-1\"
            onClick={async () => {
                if (window.SupabaseService) {
                    await window.SupabaseService.createFinanceTrackingEvent(
                        item.grn_id || 'grn-001',
                        \\\Finance Payment Dispatched for \\\\,
                        \\\Payment Proof Shared: UTR \. Amount ?\.\\\
                    );
                    alert(\\\Bill receipt and paid status are now available on the Procurement page. \\\\nUTR: \\\\);
                }
            }}
        >
            <Icons.Bell className=\"w-3.5 h-3.5\"/>
            Notify Procurement
        </button>
    </div>
) : isMatched ? (
    <div className=\"flex gap-2 justify-end items-center\">
        <button
            className=\"px-3 py-1 bg-corp-accent hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors\"
            onClick={() => {
                setSelectedInvoice(item);
                setIsBillModalOpen(true);
            }}
        >
            Pay Bill
        </button>
        <button
            disabled={true}
            title=\"Release payment first to enable notifications\"
            className=\"px-3 py-1.5 bg-gray-300 text-gray-500 rounded text-xs font-bold cursor-not-allowed border border-gray-200\"
        >
            Notify Procurement (Restricted)
        </button>
    </div>
) : (
    <div className=\"flex gap-2 justify-end items-center\">
        <span className=\"text-xs text-red-600 font-bold italic bg-red-50 border border-red-200 px-2 py-1 rounded\">
            Mismatch Block
        </span>
        <button
            disabled={true}
            title=\"Release payment first to enable notifications\"
            className=\"px-3 py-1.5 bg-gray-300 text-gray-500 rounded text-xs font-bold cursor-not-allowed border border-gray-200\"
        >
            Notify Procurement (Restricted)
        </button>
    </div>
)}\;

if (regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync('index.html', html);
    console.log('Successfully updated the file.');
} else {
    console.log('Regex did not match.');
}

