export interface TimeZoneOption {
    tzIdentifier: string;
    name: string;
    code: string;
    utcOffset: string;
    label: string;
}

export const TIMEZONES: TimeZoneOption[] = [
    { tzIdentifier: 'Pacific/Honolulu', name: 'Hawaii-Aleutian Time', code: 'HST', utcOffset: 'UTC-10:00', label: '(UTC-10:00) Hawaii-Aleutian Time' },
    { tzIdentifier: 'America/Anchorage', name: 'Alaska Time', code: 'AKST', utcOffset: 'UTC-09:00', label: '(UTC-09:00) Alaska Time' },
    { tzIdentifier: 'America/Vancouver', name: 'Pacific Time', code: 'PT', utcOffset: 'UTC-08:00', label: '(UTC-08:00) Pacific Time' },
    { tzIdentifier: 'America/Edmonton', name: 'Mountain Time', code: 'MT', utcOffset: 'UTC-07:00', label: '(UTC-07:00) Mountain Time' },
    { tzIdentifier: 'America/Chicago', name: 'Central Time', code: 'CT', utcOffset: 'UTC-06:00', label: '(UTC-06:00) Central Time' },
    { tzIdentifier: 'America/Regina', name: 'Central Standard Time', code: 'CST', utcOffset: 'UTC-06:00', label: '(UTC-06:00) Central Standard Time' },
    { tzIdentifier: 'America/Winnipeg', name: 'Central Time', code: 'CT', utcOffset: 'UTC-06:00', label: '(UTC-06:00) Central Time' },
    { tzIdentifier: 'America/Bogota', name: 'Colombia Time', code: 'COT', utcOffset: 'UTC-05:00', label: '(UTC-05:00) Colombia Time' },
    { tzIdentifier: 'America/New_York', name: 'Eastern Time', code: 'ET', utcOffset: 'UTC-05:00', label: '(UTC-05:00) Eastern Time' },
    { tzIdentifier: 'America/Caracas', name: 'Venezuela Time', code: 'VET', utcOffset: 'UTC-04:00', label: '(UTC-04:00) Venezuela Time' },
    { tzIdentifier: 'America/Halifax', name: 'Atlantic Time', code: 'AT', utcOffset: 'UTC-04:00', label: '(UTC-04:00) Atlantic Time' },
    { tzIdentifier: 'America/Santiago', name: 'Chile Time', code: 'CLT', utcOffset: 'UTC-04:00', label: '(UTC-04:00) Chile Time' },
    { tzIdentifier: 'America/St_Johns', name: 'Newfoundland Time', code: 'NT', utcOffset: 'UTC-03:30', label: '(UTC-03:30) Newfoundland Time' },
    { tzIdentifier: 'America/Buenos_Aires', name: 'Argentina Time', code: 'ART', utcOffset: 'UTC-03:00', label: '(UTC-03:00) Argentina Time' },
    { tzIdentifier: 'America/Sao_Paulo', name: 'Brasilia Time', code: 'BRT', utcOffset: 'UTC-03:00', label: '(UTC-03:00) Brasilia Time' },
    { tzIdentifier: 'Europe/London', name: 'Greenwich Mean Time', code: 'GMT', utcOffset: 'UTC+00:00', label: '(UTC+00:00) Greenwich Mean Time' },
    { tzIdentifier: 'Africa/Algiers', name: 'Central European Time', code: 'CET', utcOffset: 'UTC+01:00', label: '(UTC+01:00) Central European Time' },
    { tzIdentifier: 'Africa/Casablanca', name: 'Western European Time', code: 'WET', utcOffset: 'UTC+01:00', label: '(UTC+01:00) Western European Time' },
    { tzIdentifier: 'Africa/Lagos', name: 'West Africa Time', code: 'WAT', utcOffset: 'UTC+01:00', label: '(UTC+01:00) West Africa Time' },
    { tzIdentifier: 'Europe/Paris', name: 'Central European Time', code: 'CET', utcOffset: 'UTC+01:00', label: '(UTC+01:00) Central European Time' },
    { tzIdentifier: 'Africa/Cairo', name: 'Eastern European Time', code: 'EET', utcOffset: 'UTC+02:00', label: '(UTC+02:00) Eastern European Time' },
    { tzIdentifier: 'Africa/Johannesburg', name: 'South African Standard Time', code: 'SAST', utcOffset: 'UTC+02:00', label: '(UTC+02:00) South African Standard Time' },
    { tzIdentifier: 'Asia/Jerusalem', name: 'Israel Standard Time', code: 'IST', utcOffset: 'UTC+02:00', label: '(UTC+02:00) Israel Standard Time' },
    { tzIdentifier: 'Europe/Kyiv', name: 'Eastern European Time', code: 'EET', utcOffset: 'UTC+02:00', label: '(UTC+02:00) Eastern European Time' },
    { tzIdentifier: 'Africa/Addis_Ababa', name: 'East Africa Time', code: 'EAT', utcOffset: 'UTC+03:00', label: '(UTC+03:00) East Africa Time' },
    { tzIdentifier: 'Asia/Riyadh', name: 'Arabia Standard Time', code: 'AST', utcOffset: 'UTC+03:00', label: '(UTC+03:00) Arabia Standard Time' },
    { tzIdentifier: 'Europe/Istanbul', name: 'Turkey Time', code: 'TRT', utcOffset: 'UTC+03:00', label: '(UTC+03:00) Turkey Time' },
    { tzIdentifier: 'Europe/Moscow', name: 'Moscow Standard Time', code: 'MSK', utcOffset: 'UTC+03:00', label: '(UTC+03:00) Moscow Standard Time' },
    { tzIdentifier: 'Indian/Antananarivo', name: 'East Africa Time', code: 'EAT', utcOffset: 'UTC+03:00', label: '(UTC+03:00) East Africa Time' },
    { tzIdentifier: 'Asia/Tehran', name: 'Iran Standard Time', code: 'IRST', utcOffset: 'UTC+03:30', label: '(UTC+03:30) Iran Standard Time' },
    { tzIdentifier: 'Asia/Dubai', name: 'Gulf Standard Time', code: 'GST', utcOffset: 'UTC+04:00', label: '(UTC+04:00) Gulf Standard Time' },
    { tzIdentifier: 'Asia/Karachi', name: 'Pakistan Standard Time', code: 'PKT', utcOffset: 'UTC+05:00', label: '(UTC+05:00) Pakistan Standard Time' },
    { tzIdentifier: 'Asia/Kolkata', name: 'India Standard Time', code: 'IST', utcOffset: 'UTC+05:30', label: '(UTC+05:30) India Standard Time' },
    { tzIdentifier: 'Asia/Dhaka', name: 'Bangladesh Standard Time', code: 'BST', utcOffset: 'UTC+06:00', label: '(UTC+06:00) Bangladesh Standard Time' },
    { tzIdentifier: 'Asia/Bangkok', name: 'Indochina Time', code: 'ICT', utcOffset: 'UTC+07:00', label: '(UTC+07:00) Indochina Time' },
    { tzIdentifier: 'Asia/Jakarta', name: 'Western Indonesia Time', code: 'WIB', utcOffset: 'UTC+07:00', label: '(UTC+07:00) Western Indonesia Time' },
    { tzIdentifier: 'Asia/Hong_Kong', name: 'Hong Kong Time', code: 'HKT', utcOffset: 'UTC+08:00', label: '(UTC+08:00) Hong Kong Time' },
    { tzIdentifier: 'Asia/Manila', name: 'Philippine Time', code: 'PHT', utcOffset: 'UTC+08:00', label: '(UTC+08:00) Philippine Time' },
    { tzIdentifier: 'Asia/Shanghai', name: 'China Standard Time', code: 'CST', utcOffset: 'UTC+08:00', label: '(UTC+08:00) China Standard Time' },
    { tzIdentifier: 'Asia/Singapore', name: 'Singapore Standard Time', code: 'SGT', utcOffset: 'UTC+08:00', label: '(UTC+08:00) Singapore Standard Time' },
    { tzIdentifier: 'Australia/Perth', name: 'Australian Western Standard Time', code: 'AWST', utcOffset: 'UTC+08:00', label: '(UTC+08:00) Australian Western Standard Time' },
    { tzIdentifier: 'Asia/Seoul', name: 'Korea Standard Time', code: 'KST', utcOffset: 'UTC+09:00', label: '(UTC+09:00) Korea Standard Time' },
    { tzIdentifier: 'Asia/Tokyo', name: 'Japan Standard Time', code: 'JST', utcOffset: 'UTC+09:00', label: '(UTC+09:00) Japan Standard Time' },
    { tzIdentifier: 'Australia/Brisbane', name: 'Australian Eastern Standard Time', code: 'AEST', utcOffset: 'UTC+10:00', label: '(UTC+10:00) Australian Eastern Standard Time' },
    { tzIdentifier: 'Australia/Sydney', name: 'Australian Eastern Time', code: 'AET', utcOffset: 'UTC+10:00', label: '(UTC+10:00) Australian Eastern Time' },
    { tzIdentifier: 'Pacific/Auckland', name: 'New Zealand Standard Time', code: 'NZST', utcOffset: 'UTC+12:00', label: '(UTC+12:00) New Zealand Standard Time' },
    { tzIdentifier: 'Pacific/Fiji', name: 'Fiji Time', code: 'FJT', utcOffset: 'UTC+12:00', label: '(UTC+12:00) Fiji Time' }
];