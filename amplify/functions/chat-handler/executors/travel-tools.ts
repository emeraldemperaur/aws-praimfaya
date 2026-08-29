import axios from 'axios';
import { ToolExecutionContext } from './types';

const safeJsonParse = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
};


export const executeBooking = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const BCOM_AFFILIATE = ephemeralSecrets.bookingAffiliateId;
    const BCOM_TOKEN = ephemeralSecrets.bookingToken;
    
    if (!BCOM_AFFILIATE || !BCOM_TOKEN) {
        return { error: "Missing Booking.com credentials. Call 'request_secure_credentials' with serviceName 'booking'." };
    } 

    try {
        const headers = { 
            Authorization: `Bearer ${BCOM_TOKEN}`, 
            'X-Affiliate-Id': BCOM_AFFILIATE,
            'Content-Type': 'application/json' 
        };
        const { action, query, propertyId, orderId, checkIn, checkOut, adults, currency } = toolInput;
        const baseUrl = `https://demandapi.booking.com/3.2`;

        if (action === 'SEARCH_PROPERTIES') {
            const curr = currency || 'USD';
            const pax = adults || 1;
            const res = await axios.get(`${baseUrl}/accommodations/search?query=${encodeURIComponent(query || '')}&checkin=${checkIn}&checkout=${checkOut}&currency=${curr}&adults=${pax}`, { headers });
            return { status: "Success", properties: res.data.results?.slice(0, 15) };
        } 
        else if (action === 'GET_PROPERTY_DETAILS' && propertyId) {
            const res = await axios.get(`${baseUrl}/accommodations/${propertyId}/details`, { headers });
            return { status: "Success", details: res.data };
        } 
        else if (action === 'GET_REVIEWS' && propertyId) {
            const res = await axios.get(`${baseUrl}/accommodations/${propertyId}/reviews`, { headers });
            return { status: "Success", reviews: res.data.reviews?.slice(0, 10) }; // Bounded to protect context
        } 
        else if (action === 'GET_ORDER_DETAILS' && orderId) {
            const res = await axios.get(`${baseUrl}/orders/${orderId}`, { headers });
            return { status: "Success", order: res.data };
        }

        return { error: `Missing required parameters for Booking.com action: ${action}` };
    } catch (err: any) { 
        return { error: `Booking.com Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executePriceline = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const PL_TOKEN = ephemeralSecrets.pricelineApiKey;
    
    if (!PL_TOKEN) {
        return { error: "Missing Priceline Partner credentials. Call 'request_secure_credentials' with serviceName 'priceline'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${PL_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, destination, hotelId, reservationId } = toolInput;
        const baseUrl = `https://api.pricelinepartnersolutions.com/v3`;

        if (action === 'SEARCH_HOTELS' && destination) {
            const res = await axios.get(`${baseUrl}/hotels/search?destination=${encodeURIComponent(destination)}`, { headers });
            return { status: "Success", hotels: res.data.hotels?.slice(0, 15) };
        } 
        else if (action === 'GET_HOTEL_DETAILS' && hotelId) {
            const res = await axios.get(`${baseUrl}/hotels/${hotelId}`, { headers });
            return { status: "Success", details: res.data };
        } 
        else if (action === 'GET_REVIEWS' && hotelId) {
            const res = await axios.get(`${baseUrl}/hotels/${hotelId}/reviews`, { headers });
            return { status: "Success", reviews: res.data.reviews?.slice(0, 10) }; // Bounded
        } 
        else if (action === 'GET_RESERVATION' && reservationId) {
            const res = await axios.get(`${baseUrl}/reservations/${reservationId}`, { headers });
            return { status: "Success", reservation: res.data };
        } 
        else if (action === 'CANCEL_RESERVATION' && reservationId) {
            const res = await axios.post(`${baseUrl}/reservations/${reservationId}/cancel`, {}, { headers });
            return { status: "Success", cancellationRecord: res.data };
        }

        return { error: `Missing required parameters for Priceline action: ${action}` };
    } catch (err: any) { 
        return { error: `Priceline Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeVrbo = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const VRBO_PARTNER_ID = ephemeralSecrets.vrboPartnerId;
    const VRBO_API_KEY = ephemeralSecrets.vrboApiKey;
    
    if (!VRBO_PARTNER_ID || !VRBO_API_KEY) {
        return { error: "Missing Expedia/Vrbo credentials. Call 'request_secure_credentials' with serviceName 'vrbo'." };
    } 

    try {
        const headers = { 
            Authorization: `Bearer ${VRBO_API_KEY}`,
            'Partner-Id': VRBO_PARTNER_ID,
            'Content-Type': 'application/json' 
        };
        const { action, propertyId, reservationId, payload, startDate, endDate } = toolInput;
        const baseUrl = `https://api.expediagroup.com/v1/vrbo`;

        if (action === 'GET_LISTING' && propertyId) {
            const res = await axios.get(`${baseUrl}/properties/${propertyId}`, { headers });
            return { status: "Success", listing: res.data };
        } 
        else if (action === 'UPDATE_RATES' && propertyId && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(`${baseUrl}/properties/${propertyId}/rates`, parsedPayload, { headers });
            return { status: "Success", message: "Rates updated successfully." };
        } 
        else if (action === 'GET_AVAILABILITY' && propertyId && startDate && endDate) {
            const res = await axios.get(`${baseUrl}/properties/${propertyId}/availability?start=${startDate}&end=${endDate}`, { headers });
            return { status: "Success", calendar: res.data };
        } 
        else if (action === 'GET_RESERVATION' && reservationId) {
            const res = await axios.get(`${baseUrl}/reservations/${reservationId}`, { headers });
            return { status: "Success", reservation: res.data };
        }

        return { error: `Missing required parameters for Vrbo action: ${action}` };
    } catch (err: any) { 
        return { error: `Vrbo Error: ${err.response?.data?.message || err.message}` }; 
    }
};

export const executeAmadeus = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const AMADEUS_KEY = ephemeralSecrets.amadeusApiKey;
    const AMADEUS_SECRET = ephemeralSecrets.amadeusApiSecret;

    if (!AMADEUS_KEY || !AMADEUS_SECRET) {
        return { error: "Missing Amadeus GDS credentials. Call 'request_secure_credentials' with serviceName 'amadeus'." };
    }

    try {
        const tokenRes = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', 
            new URLSearchParams({ grant_type: "client_credentials", client_id: AMADEUS_KEY, client_secret: AMADEUS_SECRET }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        
        const headers = { Authorization: `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' };
        const { action, origin, destination, departureDate, returnDate, adults, flightOrderId } = toolInput;
        const baseUrl = 'https://test.api.amadeus.com/v2';

        if (action === 'SEARCH_FLIGHTS' && origin && destination && departureDate) {
            // High Value: Global Distribution System flight search
            let url = `${baseUrl}/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=${adults || 1}&max=10`;
            if (returnDate) url += `&returnDate=${returnDate}`;
            
            const res = await axios.get(url, { headers });
            return { status: "Success", flights: res.data.data };
        }
        else if (action === 'GET_FLIGHT_ORDER' && flightOrderId) {
            const res = await axios.get(`https://test.api.amadeus.com/v1/booking/flight-orders/${flightOrderId}`, { headers });
            return { status: "Success", order: res.data.data };
        }

        return { error: `Missing required parameters for Amadeus action: ${action}` };
    } catch (err: any) {
        return { error: `Amadeus Error: ${err.response?.data?.errors?.[0]?.detail || err.message}` };
    }
};