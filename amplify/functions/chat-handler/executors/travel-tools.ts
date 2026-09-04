import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
const MAX_RECORD_LIMIT = 15;

const safeJsonObject = (data: any, fallback: any = {}): Record<string, any> => {
    if (!data) return fallback;
    if (typeof data === 'object' && !Array.isArray(data)) return data;
    try {
        const parsed = JSON.parse(data);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const simplifyFlightOffers = (offers: any[]): any[] => {
    if (!Array.isArray(offers)) return [];
    return offers.slice(0, MAX_RECORD_LIMIT).map((offer: any) => {
        const itineraries = offer.itineraries?.map((it: any) => ({
            duration: it.duration,
            stops: (it.segments?.length || 1) - 1,
            segments: it.segments?.map((seg: any) => ({
                carrierCode: seg.carrierCode,
                flightNumber: seg.number,
                departure: { iataCode: seg.departure?.iataCode, at: seg.departure?.at },
                arrival: { iataCode: seg.arrival?.iataCode, at: seg.arrival?.at }
            }))
        }));

        return {
            id: offer.id,
            totalPrice: offer.price?.total,
            currency: offer.price?.currency,
            numberOfBookableSeats: offer.numberOfBookableSeats,
            itineraries
        };
    });
};


const simplifyPropertyDetails = (details: any): any => {
    if (!details || typeof details !== 'object') return {};
    const copy = { ...details };
    
    // Strip large image URL arrays if present
    if (Array.isArray(copy.images)) copy.images = copy.images.slice(0, 3);
    if (Array.isArray(copy.photos)) copy.photos = copy.photos.slice(0, 3);
    if (Array.isArray(copy.amenities)) copy.amenities = copy.amenities.slice(0, 20);

    return copy;
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
            const curr = encodeURIComponent(currency || 'USD');
            const pax = parseInt(adults) || 1;
            const safeQuery = encodeURIComponent(query || '');
            const safeCheckIn = checkIn ? encodeURIComponent(checkIn) : '';
            const safeCheckOut = checkOut ? encodeURIComponent(checkOut) : '';

            let searchUrl = `${baseUrl}/accommodations/search?query=${safeQuery}&currency=${curr}&adults=${pax}`;
            if (safeCheckIn) searchUrl += `&checkin=${safeCheckIn}`;
            if (safeCheckOut) searchUrl += `&checkout=${safeCheckOut}`;

            const res = await axios.get(searchUrl, { headers, timeout: TIMEOUT_MS });
            const rawProperties = Array.isArray(res.data?.results) ? res.data.results : [];
            const properties = rawProperties.slice(0, MAX_RECORD_LIMIT).map((p: any) => simplifyPropertyDetails(p));

            return { status: "Success", totalFound: rawProperties.length, returnedCount: properties.length, properties };
        } 
        else if (action === 'GET_PROPERTY_DETAILS' && propertyId) {
            const safePropId = encodeURIComponent(propertyId);
            const res = await axios.get(`${baseUrl}/accommodations/${safePropId}/details`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", details: simplifyPropertyDetails(res.data) };
        } 
        else if (action === 'GET_REVIEWS' && propertyId) {
            const safePropId = encodeURIComponent(propertyId);
            const res = await axios.get(`${baseUrl}/accommodations/${safePropId}/reviews`, { headers, timeout: TIMEOUT_MS });
            const rawReviews = Array.isArray(res.data?.reviews) ? res.data.reviews : [];
            const reviews = rawReviews.slice(0, 10).map((r: any) => ({
                headline: r.headline || r.title,
                score: r.score,
                pros: r.pros ? r.pros.substring(0, 200) : '',
                cons: r.cons ? r.cons.substring(0, 200) : '',
                date: r.date
            }));

            return { status: "Success", count: reviews.length, reviews };
        } 
        else if (action === 'GET_ORDER_DETAILS' && orderId) {
            const safeOrderId = encodeURIComponent(orderId);
            const res = await axios.get(`${baseUrl}/orders/${safeOrderId}`, { headers, timeout: TIMEOUT_MS });
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
            const safeDest = encodeURIComponent(destination);
            const res = await axios.get(`${baseUrl}/hotels/search?destination=${safeDest}`, { headers, timeout: TIMEOUT_MS });
            const rawHotels = Array.isArray(res.data?.hotels) ? res.data.hotels : [];
            const hotels = rawHotels.slice(0, MAX_RECORD_LIMIT).map((h: any) => simplifyPropertyDetails(h));

            return { status: "Success", totalFound: rawHotels.length, returnedCount: hotels.length, hotels };
        } 
        else if (action === 'GET_HOTEL_DETAILS' && hotelId) {
            const safeHotelId = encodeURIComponent(hotelId);
            const res = await axios.get(`${baseUrl}/hotels/${safeHotelId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", details: simplifyPropertyDetails(res.data) };
        } 
        else if (action === 'GET_REVIEWS' && hotelId) {
            const safeHotelId = encodeURIComponent(hotelId);
            const res = await axios.get(`${baseUrl}/hotels/${safeHotelId}/reviews`, { headers, timeout: TIMEOUT_MS });
            const rawReviews = Array.isArray(res.data?.reviews) ? res.data.reviews : [];
            const reviews = rawReviews.slice(0, 10);

            return { status: "Success", count: reviews.length, reviews };
        } 
        else if (action === 'GET_RESERVATION' && reservationId) {
            const safeResId = encodeURIComponent(reservationId);
            const res = await axios.get(`${baseUrl}/reservations/${safeResId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", reservation: res.data };
        } 
        else if (action === 'CANCEL_RESERVATION' && reservationId) {
            const safeResId = encodeURIComponent(reservationId);
            const res = await axios.post(`${baseUrl}/reservations/${safeResId}/cancel`, {}, { headers, timeout: TIMEOUT_MS });
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
            const safePropId = encodeURIComponent(propertyId);
            const res = await axios.get(`${baseUrl}/properties/${safePropId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", listing: simplifyPropertyDetails(res.data) };
        } 
        else if (action === 'UPDATE_RATES' && propertyId && payload) {
            const safePropId = encodeURIComponent(propertyId);
            const parsedPayload = safeJsonObject(payload);
            
            if (Object.keys(parsedPayload).length === 0) {
                return { error: "Invalid or empty JSON provided in payload for rate update." };
            }

            await axios.post(`${baseUrl}/properties/${safePropId}/rates`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: "Rates updated successfully." };
        } 
        else if (action === 'GET_AVAILABILITY' && propertyId && startDate && endDate) {
            const safePropId = encodeURIComponent(propertyId);
            const safeStart = encodeURIComponent(startDate);
            const safeEnd = encodeURIComponent(endDate);
            const res = await axios.get(`${baseUrl}/properties/${safePropId}/availability?start=${safeStart}&end=${safeEnd}`, { headers, timeout: TIMEOUT_MS });
            
            return { status: "Success", calendar: res.data };
        } 
        else if (action === 'GET_RESERVATION' && reservationId) {
            const safeResId = encodeURIComponent(reservationId);
            const res = await axios.get(`${baseUrl}/reservations/${safeResId}`, { headers, timeout: TIMEOUT_MS });
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
            { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: TIMEOUT_MS }
        );
        
        const headers = { Authorization: `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' };
        const { action, origin, destination, departureDate, returnDate, adults, flightOrderId } = toolInput;
        const baseUrl = 'https://test.api.amadeus.com/v2';

        if (action === 'SEARCH_FLIGHTS' && origin && destination && departureDate) {
            const safeOrigin = encodeURIComponent(origin);
            const safeDest = encodeURIComponent(destination);
            const safeDepDate = encodeURIComponent(departureDate);
            const pax = parseInt(adults) || 1;

            let url = `${baseUrl}/shopping/flight-offers?originLocationCode=${safeOrigin}&destinationLocationCode=${safeDest}&departureDate=${safeDepDate}&adults=${pax}&max=${MAX_RECORD_LIMIT}`;
            if (returnDate) url += `&returnDate=${encodeURIComponent(returnDate)}`;
            
            const res = await axios.get(url, { headers, timeout: TIMEOUT_MS });
            const rawOffers = Array.isArray(res.data?.data) ? res.data.data : [];
            const flights = simplifyFlightOffers(rawOffers);

            return { status: "Success", totalFound: rawOffers.length, returnedCount: flights.length, flights };
        }
        else if (action === 'GET_FLIGHT_ORDER' && flightOrderId) {
            const safeOrderId = encodeURIComponent(flightOrderId);
            const res = await axios.get(`https://test.api.amadeus.com/v1/booking/flight-orders/${safeOrderId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", order: res.data?.data };
        }

        return { error: `Missing required parameters for Amadeus action: ${action}` };
    } catch (err: any) { 
        return { error: `Amadeus Error: ${err.response?.data?.errors?.[0]?.detail || err.message}` }; 
    }
};