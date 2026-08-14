// Category + field definitions. `sensitive: true` fields are encrypted at rest.
export const CATEGORIES = [
  {
    key: 'passwords', label: 'Passwords', icon: 'KeyRound', entity: 'VaultItem', type: 'password',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Name', required: true },
      { name: 'website', label: 'Website' },
      { name: 'applicationIdentifier', label: 'App identifier (Android package)' },
      { name: 'username', label: 'Username' },
      { name: 'email', label: 'Email' },
      { name: 'password', label: 'Password', sensitive: true, generator: true },
      { name: 'notes', label: 'Notes', sensitive: true, multiline: true },
      { name: 'tags', label: 'Tags (comma separated)' },
    ],
  },
  {
    key: 'email', label: 'Email & Google', icon: 'Mail', entity: 'VaultItem', type: 'email',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Account name', required: true },
      { name: 'provider', label: 'Provider (Google, Outlook, iCloud…)' },
      { name: 'email', label: 'Email' },
      { name: 'username', label: 'Username' },
      { name: 'password', label: 'Password', sensitive: true, generator: true },
      { name: 'recoveryEmail', label: 'Recovery email' },
      { name: 'recoveryPhone', label: 'Recovery phone', sensitive: true },
      { name: 'website', label: 'Website' },
      { name: 'notes', label: 'Notes', sensitive: true, multiline: true },
      { name: 'tags', label: 'Tags (comma separated)' },
    ],
  },
  {
    key: 'social', label: 'Social Media', icon: 'AtSign', entity: 'VaultItem', type: 'social',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Platform / label', required: true },
      { name: 'username', label: 'Username' },
      { name: 'email', label: 'Email' },
      { name: 'password', label: 'Password', sensitive: true, generator: true },
      { name: 'website', label: 'URL' },
      { name: 'applicationIdentifier', label: 'App identifier (Android package)' },
      { name: 'notes', label: 'Notes', sensitive: true, multiline: true },
      { name: 'tags', label: 'Tags (comma separated)' },
    ],
  },
  {
    key: 'banking', label: 'Banking', icon: 'Landmark', entity: 'BankAccount',
    titleField: 'bankName',
    fields: [
      { name: 'bankName', label: 'Bank name', required: true },
      { name: 'accountHolder', label: 'Account holder' },
      { name: 'username', label: 'Username' },
      { name: 'password', label: 'Password', sensitive: true, generator: true },
      { name: 'accountNumber', label: 'Account number', sensitive: true },
      { name: 'pin', label: 'PIN', sensitive: true },
      { name: 'iban', label: 'IBAN', sensitive: true },
      { name: 'swift', label: 'SWIFT / BIC' },
      { name: 'notes', label: 'Notes', sensitive: true, multiline: true },
    ],
  },
  {
    key: 'cards', label: 'Cards', icon: 'CreditCard', entity: 'Card',
    titleField: 'name',
    fields: [
      { name: 'name', label: 'Card name', required: true },
      { name: 'cardholder', label: 'Cardholder' },
      { name: 'number', label: 'Card number', sensitive: true },
      { name: 'expiry', label: 'Expiry (MM/YY)' },
      { name: 'cvv', label: 'CVV', sensitive: true },
      { name: 'pin', label: 'PIN', sensitive: true },
      { name: 'notes', label: 'Notes', sensitive: true, multiline: true },
    ],
  },
  {
    key: 'addresses', label: 'Addresses', icon: 'MapPin', entity: 'Address',
    titleField: 'name',
    fields: [
      { name: 'name', label: 'Full name', required: true },
      { name: 'country', label: 'Country' },
      { name: 'city', label: 'City' },
      { name: 'address', label: 'Address', multiline: true },
      { name: 'postalCode', label: 'Postal code' },
      { name: 'phone', label: 'Phone' },
      { name: 'notes', label: 'Notes', sensitive: true, multiline: true },
    ],
  },
  {
    key: 'notes', label: 'Secure Notes', icon: 'FileLock', entity: 'SecureNote',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', required: true },
      { name: 'content', label: 'Content', sensitive: true, multiline: true },
    ],
  },
];

export const getCategory = (key) => CATEGORIES.find((c) => c.key === key);