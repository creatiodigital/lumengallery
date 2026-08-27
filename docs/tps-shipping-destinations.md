# theprintspace shipping destinations

Captured 2026-08-22 from the **€ PRINT ORDERS** tab of theprintspace's rate
card (Google Sheets `1wscEvtoVkN-Xhzju34CujAPP4BhOUMw89fM73TuRAnI`, gid
`2008015777`) — the euro-denominated portal channel we order through, not ASF.
See the `project_tps_pricing_calibration` memory.

**133 destinations** on the card. We sell to **38** of them
(`TPS_SUPPORTED_COUNTRIES` in `src/lib/print-providers/printspace/pricing.ts`).
Every country we sell to is on the card; the 95 we omit
are a deliberate curation, not a technical limit.

**Branch** is where the order is produced and dispatched — `DE` = Berlin,
`UK` = London. It decides whether a shipment crosses a customs border, and it is
the fact the open dropship VAT question turns on: a UK buyer served from London
is not an export from Spain.

**Courier days** is the card's own express transit estimate, production time not
included. Post is slower and, everywhere on the card, does not accept the two
largest size bands — so big prints are courier-only by construction.

Destinations marked `*` / `**` carry a footnote held inside the sheet that does
not survive CSV export. Check the sheet before relying on them. We sell to four:
Iceland\*_, Japan_, Norway*, Switzerland*.

| Country                | ISO | Region | Post branch | Courier branch | Courier days | We sell |
| ---------------------- | --- | ------ | ----------- | -------------- | ------------ | ------- |
| Albania                | AL  | ROW    | DE          | DE             | 1–2          | —       |
| Algeria                | DZ  | ROW    | UK          | DE             | 1–2          | —       |
| Angola                 | AO  | ROW    | UK          | DE             | 4–4          | —       |
| Antigua                | AG  | ROW    | UK          | DE             | 3–3          | —       |
| Argentina              | AR  | ROW    | UK          | DE             | 2–2          | —       |
| Australia              | AU  | ROW    | UK          | DE             | 4–4          | ✅      |
| Austria                | AT  | EU     | DE          | DE             | 1–1          | ✅      |
| Azerbaijan             | AZ  | ROW    | UK          | DE             | 2–2          | —       |
| Bahamas                | BS  | ROW    | UK          | DE             | 2–2          | —       |
| Bahrain                | BH  | ROW    | UK          | DE             | 2–2          | —       |
| Bangladesh             | BD  | ROW    | UK          | DE             | 3–3          | —       |
| Barbados               | BB  | ROW    | UK          | DE             | 2–2          | —       |
| Belarus                | BY  | ROW    | DE          | DE             | 2–2          | —       |
| Belgium                | BE  | EU     | DE          | DE             | 1–1          | ✅      |
| Benin                  | BJ  | ROW    | UK          | DE             | 2–2          | —       |
| Bermuda                | BM  | ROW    | UK          | DE             | 2–2          | —       |
| Bosnia-Herzegovina     | BA  | ROW    | DE          | DE             | 1–2          | —       |
| Botswana               | BW  | ROW    | UK          | DE             | 3–3          | —       |
| Brazil                 | BR  | ROW    | UK          | DE             | 3–3          | —       |
| Brunei                 | BN  | ROW    | UK          | DE             | 3–3          | —       |
| Bulgaria               | BG  | EU     | DE          | DE             | 1–2          | ✅      |
| Cameroon               | CM  | ROW    | UK          | DE             | 2–2          | —       |
| Canada                 | CA  | NORAM  | UK          | UK             | 2–3          | ✅      |
| Cayman Islands         | KY  | ROW    | UK          | DE             | 2–2          | —       |
| Chile                  | CL  | ROW    | UK          | DE             | 2–2          | —       |
| China                  | CN  | ROW    | UK          | DE             | 2–2          | —       |
| Colombia               | CO  | ROW    | UK          | DE             | 2–2          | —       |
| Costa Rica             | CR  | ROW    | UK          | DE             | 2–2          | —       |
| Croatia                | HR  | EU     | DE          | DE             | 1–2          | ✅      |
| Cyprus                 | CY  | EU     | DE          | DE             | 1–2          | ✅      |
| Czech Republic         | CZ  | EU     | DE          | DE             | 1–1          | ✅      |
| Denmark                | DK  | EU     | DE          | DE             | 1–1          | ✅      |
| Dominica               | DM  | ROW    | UK          | DE             | 3–3          | —       |
| Dominican Republic     | DO  | ROW    | UK          | DE             | 3–3          | —       |
| Ecuador                | EC  | ROW    | UK          | DE             | 2–2          | —       |
| Egypt                  | EG  | ROW    | UK          | DE             | 2–2          | —       |
| El Salvador            | SV  | ROW    | UK          | DE             | 2–2          | —       |
| Estonia                | EE  | EU     | DE          | DE             | 1–1          | ✅      |
| Ethiopia               | ET  | ROW    | UK          | DE             | 2–3          | —       |
| Finland                | FI  | EU     | DE          | DE             | 1–1          | ✅      |
| France                 | FR  | EU     | DE          | DE             | 1–1          | ✅      |
| Gabon                  | GA  | ROW    | UK          | DE             | 2–3          | —       |
| Georgia                | GE  | ROW    | UK          | DE             | 2–2          | —       |
| Germany                | DE  | DE     | DE          | DE             | 1–1          | ✅      |
| Ghana                  | GH  | ROW    | UK          | DE             | 2–3          | —       |
| Greece                 | GR  | EU     | DE          | DE             | 1–2          | ✅      |
| Guernsey               | GG  | UK     | UK          | UK             | 1–2          | —       |
| Honduras               | HN  | ROW    | UK          | DE             | 2–2          | —       |
| Hong Kong              | HK  | ROW    | UK          | DE             | 2–2          | —       |
| Hungary                | HU  | EU     | DE          | DE             | 1–1          | ✅      |
| Iceland\*\*            | IS  | ROW    | DE          | DE             | 1–1          | ✅      |
| India                  | IN  | ROW    | UK          | DE             | 2–3          | —       |
| Indonesia              | ID  | ROW    | UK          | DE             | 2–3          | —       |
| Iran                   | IR  | ROW    | UK          | DE             | 2–3          | —       |
| Ireland                | IE  | EU     | DE          | DE             | 1–1          | ✅      |
| Israel\*               | IL  | ROW    | UK          | DE             | 1–1          | —       |
| Italy                  | IT  | EU     | DE          | DE             | 1–1          | ✅      |
| Ivory Coast            | CI  | ROW    | UK          | DE             | 2–3          | —       |
| Jamaica                | JM  | ROW    | UK          | DE             | 2–3          | —       |
| Japan\*                | JP  | ROW    | UK          | DE             | 2–2          | ✅      |
| Jersey                 | JE  | UK     | UK          | UK             | 1–2          | —       |
| Jordan                 | JO  | ROW    | UK          | DE             | 2–2          | —       |
| Kazakhstan             | KZ  | ROW    | UK          | DE             | 2–2          | —       |
| Kenya                  | KE  | ROW    | UK          | DE             | 2–2          | —       |
| Korea, South           | KR  | ROW    | UK          | DE             | 2–2          | ✅      |
| Kuwait                 | KW  | ROW    | UK          | DE             | 2–2          | —       |
| Kyrgyzstan             | KG  | ROW    | UK          | DE             | 4–4          | —       |
| Latvia                 | LV  | EU     | DE          | DE             | 1–1          | ✅      |
| Lebanon                | LB  | ROW    | UK          | DE             | 2–2          | —       |
| Libya                  | LY  | ROW    | UK          | DE             | 7–7          | —       |
| Liechtenstein          | LI  | EU     | DE          | DE             | 1–1          | ✅      |
| Lithuania              | LT  | EU     | DE          | DE             | 1–1          | ✅      |
| Luxembourg             | LU  | EU     | DE          | DE             | 1–1          | ✅      |
| Macau                  | MO  | ROW    | UK          | DE             | 2–2          | —       |
| Macedonia              | MK  | ROW    | DE          | DE             | 1–1          | —       |
| Malaysia               | MY  | ROW    | UK          | DE             | 2–2          | —       |
| Malta                  | MT  | EU     | DE          | DE             | 1–1          | ✅      |
| Mauritius              | MU  | ROW    | UK          | DE             | 2–2          | —       |
| Mexico                 | MX  | ROW    | UK          | DE             | 2–2          | —       |
| Morocco                | MA  | ROW    | UK          | DE             | 2–2          | —       |
| Mozambique             | MZ  | ROW    | UK          | DE             | 3–3          | —       |
| Nepal                  | NP  | ROW    | UK          | DE             | 3–3          | —       |
| Netherlands            | NL  | EU     | DE          | DE             | 1–1          | ✅      |
| Netherlands Antilles   | AN  | ROW    | UK          | DE             | 2–3          | —       |
| New Zealand            | NZ  | ROW    | UK          | DE             | 3–3          | ✅      |
| Nigeria                | NG  | ROW    | UK          | DE             | 2–2          | —       |
| Norway\*               | NO  | EU     | DE          | DE             | 1–1          | ✅      |
| Oman                   | OM  | ROW    | UK          | DE             | 2–2          | —       |
| Pakistan               | PK  | ROW    | UK          | DE             | 2–2          | —       |
| Panama                 | PA  | ROW    | UK          | DE             | 2–2          | —       |
| Paraguay               | PY  | ROW    | UK          | DE             | 2–3          | —       |
| Peru                   | PE  | ROW    | UK          | DE             | 2–3          | —       |
| Philippines            | PH  | ROW    | UK          | DE             | 2–3          | —       |
| Poland                 | PL  | EU     | DE          | DE             | 1–1          | ✅      |
| Portugal               | PT  | EU     | DE          | DE             | 1–1          | ✅      |
| Puerto Rico            | PR  | ROW    | UK          | DE             | 2–2          | —       |
| Qatar                  | QA  | ROW    | UK          | DE             | 2–2          | —       |
| Romania                | RO  | EU     | DE          | DE             | 1–1          | ✅      |
| Russia                 | RU  | ROW    | UK          | DE             | 1–2          | —       |
| Saudi Arabia           | SA  | ROW    | UK          | DE             | 2–2          | —       |
| Serbia and Montenegro  | RS  | ROW    | DE          | DE             | 1–1          | —       |
| Seychelles             | SC  | ROW    | UK          | DE             | 3–3          | —       |
| Singapore              | SG  | ROW    | UK          | DE             | 2–2          | —       |
| Slovakia               | SK  | EU     | DE          | DE             | 1–1          | ✅      |
| Slovenia               | SI  | EU     | DE          | DE             | 1–1          | ✅      |
| South Africa\*\*       | ZA  | ROW    | UK          | DE             | 2–2          | —       |
| Spain                  | ES  | EU     | DE          | DE             | 1–1          | ✅      |
| Sri Lanka              | LK  | ROW    | UK          | DE             | 2–3          | —       |
| Sweden                 | SE  | EU     | DE          | DE             | 1–1          | ✅      |
| Switzerland\*          | CH  | EU     | DE          | DE             | 1–1          | ✅      |
| Syria                  | SY  | ROW    | UK          | DE             | 7–7          | —       |
| Taiwan                 | TW  | ROW    | UK          | DE             | 2–2          | —       |
| Tajikistan             | TJ  | ROW    | UK          | DE             | 2–3          | —       |
| Tanzania               | TZ  | ROW    | UK          | DE             | 2–2          | —       |
| Thailand               | TH  | ROW    | UK          | DE             | 2–3          | —       |
| Trinidad & Tobago      | TT  | ROW    | UK          | DE             | 3–3          | —       |
| Tunisia                | TN  | ROW    | UK          | DE             | 2–3          | —       |
| Turkey                 | TR  | ROW    | UK          | DE             | 2–2          | —       |
| Turkmenistan           | TM  | ROW    | UK          | DE             | 4–4          | —       |
| Turks & Caicos Islands | TC  | ROW    | UK          | DE             | 3–3          | —       |
| Uganda                 | UG  | ROW    | UK          | DE             | 2–3          | —       |
| Ukraine                | UA  | ROW    | DE          | DE             | 2–3          | —       |
| United Arab Emirates   | AE  | ROW    | UK          | DE             | 2–2          | —       |
| United Kingdom         | GB  | UK     | UK          | UK             | 1–1          | ✅      |
| United States          | US  | NORAM  | UK          | UK             | 1–2          | ✅      |
| Uruguay                | UY  | ROW    | UK          | DE             | 2–2          | —       |
| Uzbekistan             | UZ  | ROW    | UK          | DE             | 4–4          | —       |
| Venezuela              | VE  | ROW    | UK          | DE             | 3–3          | —       |
| Vietnam                | VN  | ROW    | UK          | DE             | 2–3          | —       |
| Virgin Islands         | VG  | ROW    | UK          | DE             | 2–2          | —       |
| Yemen                  | YE  | ROW    | UK          | DE             | 7–7          | —       |
| Zambia                 | ZM  | ROW    | UK          | DE             | 3–3          | —       |
| Zimbabwe               | ZW  | ROW    | UK          | DE             | 3–3          | —       |
