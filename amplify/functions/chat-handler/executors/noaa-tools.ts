import axios from 'axios';
import { ToolExecutionContext } from './types';

const NWS_API_BASE = 'https://api.weather.gov';
const CDO_API_BASE = 'https://www.ncdc.noaa.gov/cdo-web/api/v2';
const NWPS_API_BASE = 'https://api.water.noaa.gov/nwps/v1';

const TIMEOUT_MS = 15000;
const MAX_CLIMATE_RECORDS_RETURNED = 50;
const MAX_ALERTS = 20;

const formatAxiosError = (err: any): string => {
    if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') return data.slice(0, 300);
        if (data.detail) return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        if (data.message) return typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    }
    return err.message || 'Unknown network error occurred while reaching NOAA services.';
};

const isValidCoordinate = (lat: any, lon: any): boolean => {
    return (
        typeof lat === 'number' && 
        typeof lon === 'number' && 
        !Number.isNaN(lat) && 
        !Number.isNaN(lon) &&
        lat >= -90 && lat <= 90 &&
        lon >= -180 && lon <= 180
    );
};

export const executeNoaaWeather = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const CDO_TOKEN = ephemeralSecrets?.noaaCdoToken;
    const APP_USER_AGENT = process.env.NOAA_USER_AGENT || 'VanguardAIAgent/1.0 (me@mekaegwim.ca)';

    try {
        const { action, latitude, longitude, datasetId, stationId, startDate, endDate } = toolInput;
        const baseCost = { action: `NOAA_${action}`, creditsToDeduct: 5 };

        if (action === 'GET_FORECAST') {
            if (!isValidCoordinate(latitude, longitude)) {
                return { error: "Valid numeric 'latitude' (-90 to 90) and 'longitude' (-180 to 180) are required." };
            }

            const cleanLat = Number(latitude).toFixed(4);
            const cleanLon = Number(longitude).toFixed(4);

            const pointsRes = await axios.get(`${NWS_API_BASE}/points/${cleanLat},${cleanLon}`, {
                headers: { 'User-Agent': APP_USER_AGENT, 'Accept': 'application/geo+json' },
                timeout: TIMEOUT_MS
            });

            const forecastUrl = pointsRes.data?.properties?.forecast;
            if (!forecastUrl) {
                return { error: `Could not resolve NWS forecast grid for coordinates (${cleanLat}, ${cleanLon}).` };
            }

            const forecastRes = await axios.get(forecastUrl, {
                headers: { 'User-Agent': APP_USER_AGENT, 'Accept': 'application/geo+json' },
                timeout: TIMEOUT_MS
            });

            const rawPeriods = forecastRes.data?.properties?.periods || [];
            const slimmedForecast = rawPeriods.slice(0, 7).map((p: any) => ({
                name: p.name,
                temperature: p.temperature,
                temperatureUnit: p.temperatureUnit,
                windSpeed: p.windSpeed,
                windDirection: p.windDirection,
                shortForecast: p.shortForecast,
                detailedForecast: p.detailedForecast
            }));

            return {
                status: "Success",
                coordinates: { latitude: Number(cleanLat), longitude: Number(cleanLon) },
                elevation: forecastRes.data?.properties?.elevation?.value || null,
                forecast: slimmedForecast,
                billingMetrics: baseCost
            };
        }

        else if (action === 'GET_ALERTS') {
            if (!isValidCoordinate(latitude, longitude)) {
                return { error: "Valid numeric 'latitude' and 'longitude' are required for GET_ALERTS." };
            }

            const cleanLat = Number(latitude).toFixed(4);
            const cleanLon = Number(longitude).toFixed(4);

            const alertsRes = await axios.get(`${NWS_API_BASE}/alerts/active`, {
                params: { point: `${cleanLat},${cleanLon}` },
                headers: { 'User-Agent': APP_USER_AGENT, 'Accept': 'application/geo+json' },
                timeout: TIMEOUT_MS
            });

            const rawFeatures = alertsRes.data?.features || [];
            
            // Limit unbounded arrays to prevent context window crash during widespread storms
            const slimmedAlerts = rawFeatures.slice(0, MAX_ALERTS).map((f: any) => ({
                id: f.properties?.id,
                event: f.properties?.event,
                headline: f.properties?.headline,
                severity: f.properties?.severity,
                urgency: f.properties?.urgency,
                certainty: f.properties?.certainty,
                effective: f.properties?.effective,
                expires: f.properties?.expires,
                description: f.properties?.description,
                instruction: f.properties?.instruction
            }));

            return {
                status: "Success",
                activeAlertsCount: rawFeatures.length,
                returnedCount: slimmedAlerts.length,
                alerts: slimmedAlerts,
                billingMetrics: baseCost
            };
        }

        else if (action === 'GET_CLIMATE_DATA') {
            if (!CDO_TOKEN) {
                return { error: "Missing NOAA CDO API token. Call 'request_secure_credentials' with serviceName 'noaa_cdo'." };
            }
            if (!datasetId || !stationId || !startDate || !endDate) {
                return { error: "'datasetId', 'stationId', 'startDate', and 'endDate' (YYYY-MM-DD) are required for GET_CLIMATE_DATA." };
            }

            const climateRes = await axios.get(`${CDO_API_BASE}/data`, {
                params: {
                    datasetid: datasetId,
                    stationid: stationId,
                    startdate: startDate,
                    enddate: endDate,
                    limit: MAX_CLIMATE_RECORDS_RETURNED
                },
                headers: { token: CDO_TOKEN },
                timeout: TIMEOUT_MS
            });

            const rawResults = climateRes.data?.results || [];
            const slimmedClimateData = rawResults.map((r: any) => ({
                date: r.date,
                datatype: r.datatype,
                value: r.value,
                attributes: r.attributes
            }));

            return {
                status: "Success",
                datasetId,
                stationId,
                recordCountReturned: slimmedClimateData.length,
                totalAvailableRecords: climateRes.data?.metadata?.resultset?.count || slimmedClimateData.length,
                climateData: slimmedClimateData,
                billingMetrics: baseCost
            };
        }

        else if (action === 'GET_STREAMFLOW') {
            if (!stationId) {
                return { error: "'stationId' (Gauge ID) is required for GET_STREAMFLOW." };
            }

            const waterRes = await axios.get(`${NWPS_API_BASE}/gauges/${stationId}`, {
                headers: { 'User-Agent': APP_USER_AGENT, 'Accept': 'application/json' },
                timeout: TIMEOUT_MS
            });

            const data = waterRes.data || {};

            return {
                status: "Success",
                gauge: {
                    id: data.id || stationId,
                    name: data.name || null,
                    status: data.status || null,
                    currentStage: data.status?.observed?.primary || null,
                    stageUnit: data.status?.observed?.primaryUnit || null,
                    floodStage: data.flood?.stages?.flood || null,
                    actionStage: data.flood?.stages?.action || null
                },
                billingMetrics: baseCost
            };
        }

        return { error: `Unsupported NOAA action: ${action}` };

    } catch (err: any) {
        const safeError = formatAxiosError(err);
        console.error(`[executeNoaaWeather] Error: ${safeError}`);
        return { error: `NOAA API Error: ${safeError}` };
    }
};