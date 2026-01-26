import { FletcherChecklistSection } from '@/types'

/* 
  Fletcher APK Checklist Definition
  This defines all the checklist sections and items for the Fletcher QR Ordering APK
*/

export const FLETCHER_CHECKLIST: FletcherChecklistSection[] = [
  {
    key: 'general',
    title: 'Algemeen',
    items: [
      { key: 'qr_codes_placement', label: 'Liggen/staan de fysieke QR-codes overal waar nodig' },
      { key: 'qr_codes_readable', label: 'Zijn ze goed leesbaar en niet beschadigd' },
      { key: 'times_correct', label: 'Kloppen alle ingestelde tijden' },
      { key: 'no_duplicate_qr', label: 'Zijn er dubbele QR-codes aanwezig in de backoffice' },
      { key: 'inactive_qr_cleanup', label: 'Zijn er inactieve QR-codes die verwijderd kunnen worden (opschonen QR-database)' },
      { key: 'tablet_active', label: 'Laatst gebruikte online tablet: nog actief' },
      { key: 'tablet_no_errors', label: 'Laatst gebruikte online tablet: geen foutmeldingen' },
      { key: 'tablet_settings_correct', label: 'Laatst gebruikte online tablet: instellingen duidelijk en correct' },
      { key: 'table_numbering_correct', label: 'Klopt de tafel- en kamernummering' },
      { key: 'layout_changes', label: 'Zijn er wijzigingen geweest in de indeling' },
      { key: 'group_app_contacts_added', label: 'Is de groepsapp up-to-date: juiste verantwoordelijken toegevoegd' },
      { key: 'group_app_contacts_removed', label: 'Is de groepsapp up-to-date: vertrokken medewerkers verwijderd' },
    ],
  },
  {
    key: 'areas',
    title: "Area's",
    items: [
      { key: 'area_roomservice', label: 'Roomservice' },
      { key: 'area_restaurant', label: 'Restaurant' },
      { key: 'area_terras', label: 'Terras' },
      { key: 'area_bowling', label: 'Bowlingbaan (indien van toepassing)' },
    ],
  },
  {
    key: 'roomservice',
    title: 'Roomservice',
    items: [
      { key: 'rs_fee_correct', label: 'Roomservice fee correct toegevoegd' },
      { key: 'rs_payments_active', label: 'Betalingen actief' },
      { key: 'rs_outside_timeslot', label: '"Outside tijdslot"-scherm toegevoegd' },
      { key: 'rs_upsell_welcome', label: 'Gewenste upsell verwerkt in het welkomstbericht' },
      { key: 'rs_main_settings', label: 'Hoofdinstellingen correct ingesteld en actief' },
    ],
  },
  {
    key: 'restaurant',
    title: 'Restaurant',
    items: [
      { key: 'rest_service_buttons', label: 'Serviceknoppen correct ingesteld' },
      { key: 'rest_upsell_active', label: 'Upsell actief' },
      { key: 'rest_upsell_coffee', label: 'Upsell: Koffie + gebak' },
      { key: 'rest_upsell_drinks', label: 'Upsell: Dranken + borrel' },
      { key: 'rest_menu_lunch', label: 'Juiste menukaart zichtbaar: Lunch' },
      { key: 'rest_menu_borrel', label: 'Juiste menukaart zichtbaar: Borrelkaart tijdens borreluren' },
      { key: 'rest_menu_diner', label: 'Juiste menukaart zichtbaar: Diner' },
      { key: 'rest_no_duplicate_items', label: 'Menu opgeschoond: geen dubbele items' },
      { key: 'rest_no_outdated_items', label: 'Menu opgeschoond: geen verouderde items' },
    ],
  },
  {
    key: 'terras',
    title: 'Terras',
    items: [
      { key: 'terras_plaatjes', label: 'Plaatjes gebruikt in plaats van stickers' },
      { key: 'terras_qr_visible', label: 'QR-codes goed zichtbaar vanaf de zitplaatsen' },
      { key: 'terras_menu_linked', label: 'Juiste menukaart gekoppeld aan het terras' },
    ],
  },
]

/* Get total number of checklist items */
export const getTotalChecklistItems = (): number => {
  return FLETCHER_CHECKLIST.reduce((total, section) => total + section.items.length, 0)
}

/* Get flat list of all checklist items with section info */
export const getAllChecklistItems = (): Array<{ key: string; label: string; section: string; sectionTitle: string }> => {
  const items: Array<{ key: string; label: string; section: string; sectionTitle: string }> = []
  FLETCHER_CHECKLIST.forEach(section => {
    section.items.forEach(item => {
      items.push({
        key: item.key,
        label: item.label,
        section: section.key,
        sectionTitle: section.title,
      })
    })
  })
  return items
}
