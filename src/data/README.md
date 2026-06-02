# Mobile Money Providers Configuration

This directory contains configuration data for mobile money providers available in different countries.

## File: `mobile-money-providers.json`

This JSON file maps country names to their available mobile money providers.

### Structure

```json
{
  "Country Name": [
    "Provider 1",
    "Provider 2",
    ...
  ]
}
```

### Example

```json
{
  "Kenya": [
    "M-Pesa",
    "Airtel"
  ],
  "Ghana": [
    "MTN",
    "Vodafone/Telecel",
    "Airtel"
  ]
}
```

## How to Update

### Adding a New Country

1. Open `mobile-money-providers.json`
2. Add a new entry with the country name and array of providers:

```json
{
  "Existing Country": ["Provider 1"],
  "New Country": [
    "Provider A",
    "Provider B"
  ]
}
```

### Adding a Provider to an Existing Country

1. Find the country in the JSON file
2. Add the new provider to the array:

```json
{
  "Kenya": [
    "M-Pesa",
    "Airtel",
    "New Provider"  // Added
  ]
}
```

### Removing a Provider

1. Find the country in the JSON file
2. Remove the provider from the array:

```json
{
  "Kenya": [
    "M-Pesa"
    // "Airtel" - Removed
  ]
}
```

### Removing a Country

Simply delete the entire country entry from the JSON file.

## Important Notes

1. **Country Names Must Match**: The country names in this file must exactly match the country names used in your catalog countries list. Case-sensitive!

2. **Automatic Updates**: Changes to this file will automatically reflect in the UI after the app reloads. No code changes needed.

3. **Validation**: If a country is not in this file, the mobile money provider dropdown will:
   - Be disabled
   - Show "No providers available for this country"
   - Display a warning message suggesting bank transfer instead

4. **Provider Order**: Providers appear in the dropdown in the same order they are listed in the array.

## Current Supported Countries

As of the last update, mobile money is available in:

- Ghana
- Kenya
- Tanzania
- Uganda
- Ethiopia
- Rwanda
- Cameroon
- Senegal
- Ivory Coast
- Malawi
- Madagascar
- South Sudan
- Bangladesh
- Pakistan

## Testing After Changes

After updating the providers list:

1. Reload the application
2. Navigate to Add Beneficiary
3. Select "Mobile Money" as delivery channel
4. Select a country you modified
5. Verify the providers appear correctly in the dropdown

## Format Guidelines

- Use double quotes for strings
- Maintain proper JSON syntax (commas, brackets)
- Use consistent naming for providers (e.g., "M-Pesa" not "m-pesa" or "MPesa")
- Keep provider names user-friendly (as they appear in the UI)
- Alphabetical order within each country array is recommended but not required

## Error Handling

If the JSON file is malformed:
- The application will fail to load the providers
- All countries will show "No providers available"
- Check browser console for JSON parsing errors

Always validate your JSON syntax after editing. You can use online validators like jsonlint.com.
