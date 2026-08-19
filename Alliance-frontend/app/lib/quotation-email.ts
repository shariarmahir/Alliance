import "server-only";
import { formatPrice } from "@/app/lib/utils";

// Inline-styled HTML for the "Save and Email" quotation send — email clients
// strip <style> blocks and external CSS inconsistently, so every rule here
// is inline. Colors match the storefront's brand tokens (app/globals.css):
// primary #007DCC, accent #FFB900.

function formatIssuedDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}.${m}.${y}`;
}

// Internal notice sent to the company inbox the moment a customer submits a
// price request — distinct from buildQuotationEmailHtml, which goes to the
// customer once an admin has priced and issued the quotation.
export function buildPriceRequestEmailHtml(args: {
  quotationId: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  country: string;
  itemCount: number;
  totalUnits: number;
  notes: string;
}): string {
  const { quotationId, fullName, email, phone, companyName, country, itemCount, totalUnits, notes } = args;

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

            <tr>
              <td style="background-color:#0d1626;padding:28px 32px;">
                <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">AutoLink<span style="color:#FFB900;">.</span></span>
                <div style="font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">
                  New price request
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#475569;">
                  A new price request was submitted on the website. The full request is attached as a PDF —
                  quote it in the admin dashboard when ready.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Contact</td>
                          <td align="right" style="font-size:13px;font-weight:700;color:#1e293b;padding:4px 0;">${fullName}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Company</td>
                          <td align="right" style="font-size:13px;color:#1e293b;padding:4px 0;">${companyName || "-"}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Email</td>
                          <td align="right" style="font-size:13px;color:#1e293b;padding:4px 0;">${email}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Phone</td>
                          <td align="right" style="font-size:13px;color:#1e293b;padding:4px 0;">${phone}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Country</td>
                          <td align="right" style="font-size:13px;color:#1e293b;padding:4px 0;">${country || "-"}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:8px 0 0;border-top:1px solid #e2e8f0;">Lines / units</td>
                          <td align="right" style="font-size:13px;font-weight:700;color:#007DCC;padding:8px 0 0;border-top:1px solid #e2e8f0;">${itemCount} / ${totalUnits}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${
                  notes
                    ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#475569;"><strong style="color:#1e293b;">Notes:</strong> ${notes}</p>`
                    : ""
                }

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="background-color:#FFB900;border-radius:8px;">
                      <span style="display:inline-block;padding:12px 20px;font-size:13px;font-weight:700;color:#1e293b;">
                        📎 Price Request attached (PDF)
                      </span>
                    </td>
                  </tr>
                </table>

                <p style="margin:20px 0 0;font-size:11.5px;color:#94a3b8;">
                  Request ID: <span style="font-family:monospace;">${quotationId}</span>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildQuotationEmailHtml(args: {
  recipientName: string;
  companyName: string;
  refNumber: string;
  subject: string;
  issuedDate: string;
  itemCount: number;
  grandTotal: number;
  trackingId: string;
}): string {
  const { recipientName, companyName, refNumber, subject, issuedDate, itemCount, grandTotal, trackingId } =
    args;
  const greetingName = recipientName?.trim() || "Sir/Madam";

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

            <tr>
              <td style="background-color:#0d1626;padding:28px 32px;">
                <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">AutoLink<span style="color:#FFB900;">.</span></span>
                <div style="font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">
                  Autolink Integrated Technologies
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">Dear ${greetingName},</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#475569;">
                  Thank you for your inquiry${companyName ? ` on behalf of <strong>${companyName}</strong>` : ""}.
                  We are pleased to share our price quotation for <strong>${subject}</strong>.
                  The full offer, including specifications, pricing and terms, is attached as a PDF.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Reference</td>
                          <td align="right" style="font-size:13px;font-weight:700;color:#1e293b;font-family:monospace;padding:4px 0;">${refNumber}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Date issued</td>
                          <td align="right" style="font-size:13px;color:#1e293b;padding:4px 0;">${formatIssuedDate(issuedDate)}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:4px 0;">Line items</td>
                          <td align="right" style="font-size:13px;color:#1e293b;padding:4px 0;">${itemCount}</td>
                        </tr>
                        <tr>
                          <td style="font-size:12px;color:#64748b;padding:8px 0 0;border-top:1px solid #e2e8f0;">Grand total</td>
                          <td align="right" style="font-size:16px;font-weight:800;color:#007DCC;padding:8px 0 0;border-top:1px solid #e2e8f0;">${formatPrice(grandTotal)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="background-color:#FFB900;border-radius:8px;">
                      <span style="display:inline-block;padding:12px 20px;font-size:13px;font-weight:700;color:#1e293b;">
                        📎 Price Quotation attached (PDF)
                      </span>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#475569;">
                  Your tracking reference for this request is
                  <strong style="font-family:monospace;color:#1e293b;">${trackingId}</strong>.
                  Once you're ready to proceed, simply reply to this email or reach us on WhatsApp and our team will confirm delivery and next steps.
                </p>

                <p style="margin:24px 0 0;font-size:14px;color:#1e293b;">
                  Regards,<br/>
                  <strong>Md Nurul Islam</strong><br/>
                  <span style="color:#64748b;font-size:13px;">AutoLink Integrated Technologies</span>
                </p>
              </td>
            </tr>

            <tr>
              <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
                <p style="margin:0;font-size:11.5px;line-height:1.7;color:#94a3b8;">
                  House: 104, Road: 15, Sector: 11, Uttara, Dhaka-1230, Bangladesh<br/>
                  <a href="mailto:info@auto-bd.com" style="color:#007DCC;text-decoration:none;">info@auto-bd.com</a>
                  &nbsp;·&nbsp;
                  <a href="https://wa.me/8801713116019" style="color:#007DCC;text-decoration:none;">+8801713-116019</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
