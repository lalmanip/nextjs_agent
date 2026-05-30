This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3005](http://localhost:3005) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Hostinger

Push the code to dev branch of git (https://github.com/muranjan10184/vivance-ui/), the CI/CD pipeline should deploy it to DEV hostinger.

# Prompt for AI

Build the home page of http://www.vivancetravels.com in nextJS. This is a travel portal to buy tickets for flights, Hotels, Cruise, Holidays package etc. The theme color is #FC6603

This home page will have Sign In/ Sign Up option. Sign In/Sign Up will use API to create, authenticate and reset password as needed. Here are details of the API -

Follow this CORS Solution: Create a server-side API route (/api/auth) that handles the external API calls with proper headers, avoiding browser CORS restrictions

The client-side code now should call the local /api/auth endpoint, which then make the actual API calls to your external service with the required X-API-KEY header.

while calling all the API, include this header :
headers = {
'Content-Type': 'application/json',
'X-API-KEY': 'viv-8806f318-1ecf-11ee-b64f-36e9be0141c6'
}

Sign Up API: {{baseURL}}/vivapi-user/user/create (POST method)

REQUEST Body:
{
"userType" : "4",
"email" : "createuser@gmail.com",
"userName" : "shivanip",
"password" : "zaq12wsx",
"status" : "0",
"firstName": "Shivani",
"lastName":"Prasad",
"countryCode" : "92",
"emailActivation": false
}

RESPONSE Body:
{
"response": {
"userId": 81,
"userType": 4,
"email": "createuser333@gmail.com",
"userName": "shivanip",
"password": "zaq12wsx",
"status": 0,
"firstName": "Shivani",
"middleName": null,
"lastName": "Prasad",
"countryCode": 92,
"phone": null,
"emailActivation": false,
"createdById": null,
"createdBy": null,
"createdOn": "2025-05-25T02:39:09.048+00:00",
"modifiedBy": null,
"modifiedOn": "2025-05-25T02:39:09.048+00:00"
},
"message": null,
"status": "success"
}

AuthenticateUser / Sign In API : {{baseURL}}/vivapi-user/user/authenticate (POST method)
REQUEST Body:
{
"userName" : "MobileUser",
"password" : "mobilepasswd",
"userType": 3
}

RESPONSE Body:
{
"response": {
"userId": 71,
"userType": 4,
"email": "createuser11@gmail.com",
"userName": "CreateUser11",
"password": "zaq12wsx",
"status": 0,
"firstName": "Create",
"middleName": null,
"lastName": "User",
"countryCode": 92,
"phone": null,
"emailActivation": false,
"createdBy": null,
"createdOn": "2025-01-26T21:37:01.000+00:00",
"modifiedBy": null,
"modifiedOn": "2025-01-26T21:37:01.000+00:00"
},
"message": null,
"status": "success"
}

ResetPassword API: {{baseURL}}/vivapi-user/user/reset (POST method)
REQUEST Body:
{
"userName" : "MobileUser",
"password" : "mobilepasswd111"
}

RESPONSE Body:
{
"response": "success",
"error": null,
"message": null
}

Visitors should be able to book tickets even if they do not sign up.

Lets first build Flight section.

In Flights Tab, Add the Flight Option like "Oneway" , "Round Trip" and "MultiCity".
When Oneway is selected, Return Date should be grayed out.

"To" and "From" field will pull data using an API (URL : {{baseURL}}/vivapi-mt/flight/airport/all - GET method, No body). When the passenger starts typing in Departure City or Destination City, it should match with "airportCode" or "airportName" and allow to select from that.
Also, allow passenger to choose "Infant (0-2), Children (2-11) and Adults (12+) count".
It should also have option to select the Cabin Class (Economy, Business, First etc).

When "Search" button is clicked, First it will call domain_currency API to receive the token. Same token will be used in subsequent API call while booking the flight ticket. Here is the domain_currency API details -
url = {{baseURL}}/vivapi-mt/rest/domain_currency).
body : {
"domain_key": "TMX5193291565602439",
"username": "test229267",
"password": "test@229",
"system": "test"
}

Same header as mentioned earlier.
Now it will call search API.

URL : {{baseURL}}/vivapi-mt/flight/service/search.
Header as above.
Authorization : Bearer Token with Token received from domain_currency
Sample of Body :
{
"AdultCount": "1",
"ChildCount": "0",
"InfantCount": "0",
"JourneyType": "OneWay",
"PreferredAirlines": [
""
],
"CabinClass": "Economy",
"Segments": [
{
"Origin": "BOM",
"Destination": "DEL",
"DepartureDate": "2024-12-25T00:00:00"

        }
    ]

}

Whatever response we get from search api, I need to show in next page with option to select the resulted flights

The response of search api is like this - {
"status": 1,
"search": {
"flightDataList": {
"journeyList": [
[
{
"flightDetails": {
"details": [
[
{
"origin": {
"airportCode": "BOM",
"cityName": "Mumbai",
"airportName": "Chhatrapati Shivaji International Airport",
"dateTime": "2025-11-28 21:00:00",
"terminal": "2",
"fdtv": 1764363600,
"timezoneOffset": "+05:30"
},
"destination": {
"airportCode": "DEL",
"cityName": "Delhi",
"airportName": "Indira Gandhi International Airport",
"dateTime": "2025-11-28 23:10:00",
"terminal": "3",
"fatv": 1764371400,
"timezoneOffset": "+05:30"
},
"operatorCode": "AI",
"marketingCompany": "AI",
"displayOperatorCode": "AI",
"validatingAirline": "AI",
"operatorName": "AIR INDIA",
"flightNumber": "816",
"attr": {
"baggage": "15 Kg",
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
},
"bookingClass": "V"
}
]
]
},
"price": {
"currency": "INR",
"totalDisplayFare": 10112.81,
"priceBreakup": {
"basicFare": 8727.0,
"tax": 1385.81,
"commissiontype": "domestic"
},
"passengerBreakup": {
"adt": {
"basePrice": 8727.0,
"tax": 1385.81,
"totalPrice": 10112.81,
"passengerCount": 1,
"flightAttr": {
"1": [
{
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
}
]
}
}
}
},
"resultToken": "b0ce0ffcf846cf8cb54cdd49a0c467308a5d8e52$d9ab7033174ad9e49dd308db9e4b16ae2b689494",
"attr": {
"isRefundable": false
}
},
{
"flightDetails": {
"details": [
[
{
"origin": {
"airportCode": "BOM",
"cityName": "Mumbai",
"airportName": "Chhatrapati Shivaji International Airport",
"dateTime": "2025-11-28 10:00:00",
"terminal": "2",
"fdtv": 1764324000,
"timezoneOffset": "+05:30"
},
"destination": {
"airportCode": "DEL",
"cityName": "Delhi",
"airportName": "Indira Gandhi International Airport",
"dateTime": "2025-11-28 12:15:00",
"terminal": "3",
"fatv": 1764332100,
"timezoneOffset": "+05:30"
},
"operatorCode": "AI",
"marketingCompany": "AI",
"displayOperatorCode": "AI",
"validatingAirline": "AI",
"operatorName": "AIR INDIA",
"flightNumber": "2430",
"attr": {
"baggage": "15 Kg",
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
},
"bookingClass": "V"
}
]
]
},
"price": {
"currency": "INR",
"totalDisplayFare": 10112.81,
"priceBreakup": {
"basicFare": 8727.0,
"tax": 1385.81,
"commissiontype": "domestic"
},
"passengerBreakup": {
"adt": {
"basePrice": 8727.0,
"tax": 1385.81,
"totalPrice": 10112.81,
"passengerCount": 1,
"flightAttr": {
"1": [
{
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
}
]
}
}
}
},
"resultToken": "b0ce0ffcf846cf8cb54cdd49a0c467308a5d8e52$47465eb253bc2b5276e3f46e53bc53eea3a9d6f4",
"attr": {
"isRefundable": false
}
}

Flight Details are under "flightDetails" tag. So display these results in the next page when search flight is clicked.

why there is 500 error in @terminal for api/flight/token ?

Issue: The most likely issue is that the backend server at localhost:8080 is not running or not accessible.

Solution: Update all the url and reference to dev url instead of localhost
✅ Updated /api/flight/search endpoint URL from:

{{baseURL}}/vivapi-mt/flight/service/search
TO: {{baseURL}}/vivapi-user/flight/service/search
Headers being sent in the flight search request:

Content-Type: application/json
X-API-KEY: viv-8806f318-1ecf-11ee-b64f-36e9be0141c6
Authorization: Bearer ${token}
The error was happening because the endpoint was trying to connect to localhost:8080 which wasn't running. Now it will use the correct production API URL at next.vivancetravels.com.

## Flight Details are under "flightDetails" tag. So display these results in the next page when search flight is clicked.

when trip type is "Roundtrip", in that case, the response comes as below - {
"status": 1,
"search": {
"flightDataList": {
"journeyList": [
[
{
"flightDetails": {
"details": [
[
{
"origin": {
"airportCode": "BOM",
"cityName": "Mumbai",
"airportName": "Chhatrapati Shivaji International Airport",
"dateTime": "2025-11-27 01:30:00",
"terminal": "2",
"fdtv": 1764207000,
"timezoneOffset": "+05:30"
},
"destination": {
"airportCode": "DEL",
"cityName": "Delhi",
"airportName": "Indira Gandhi International Airport",
"dateTime": "2025-11-27 03:45:00",
"terminal": "3",
"fatv": 1764215100,
"timezoneOffset": "+05:30"
},
"operatorCode": "AI",
"marketingCompany": "AI",
"displayOperatorCode": "AI",
"validatingAirline": "AI",
"operatorName": "AIR INDIA",
"flightNumber": "2422",
"attr": {
"baggage": "15 Kg",
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
},
"bookingClass": "V"
}
],
[
{
"origin": {
"airportCode": "DEL",
"cityName": "Delhi",
"airportName": "Indira Gandhi International Airport",
"dateTime": "2025-12-25 17:15:00",
"terminal": "3",
"fdtv": 1766682900,
"timezoneOffset": "+05:30"
},
"destination": {
"airportCode": "BOM",
"cityName": "Mumbai",
"airportName": "Chhatrapati Shivaji International Airport",
"dateTime": "2025-12-25 19:20:00",
"terminal": "2",
"fatv": 1766690400,
"timezoneOffset": "+05:30"
},
"operatorCode": "AI",
"marketingCompany": "AI",
"displayOperatorCode": "AI",
"validatingAirline": "AI",
"operatorName": "AIR INDIA",
"flightNumber": "2981",
"attr": {
"baggage": "15 Kg",
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
},
"bookingClass": "V"
}
]
]
},
"price": {
"currency": "INR",
"totalDisplayFare": 19295.66,
"priceBreakup": {
"basicFare": 16622.0,
"tax": 2673.66,
"commissiontype": "domestic"
},
"passengerBreakup": {
"adt": {
"basePrice": 16622.0,
"tax": 2673.66,
"totalPrice": 19295.66,
"passengerCount": 1,
"flightAttr": {
"1": [
{
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
}
],
"2": [
{
"availableSeats": "9",
"isRefundable": false,
"bookingClass": "V",
"cabinClass": "Economy Class"
}
]
}
}
}
},
"resultToken": "93053385a6db08cfcfb22454dcfa425bb3676021$1f32e9dbb239a0d1c8ebb13db910e77134b1bebc",
"attr": {
"isRefundable": false
}
},
{
"flightDetails": {
"details": [
[
{
"origin": {
"airportCode": "BOM",
"cityName": "Mumbai",
"airportName": "Chhatrapati Shivaji International Airport",
"dateTime": "2025-11-27 22:25:00",
"terminal": "1",
"fdtv": 1764282300,
"timezoneOffset": "+05:30"
},
"destination": {
"airportCode": "DEL",
"cityName": "Delhi",
"airportName": "Indira Gandhi International Airport",
"dateTime": "2025-11-28 00:40:00",
"terminal": "1",
"fatv": 1764290400,
"timezoneOffset": "+05:30"
},
"operatorCode": "SG",
"marketingCompany": "SG",
"displayOperatorCode": "SG",
"validatingAirline": "GP",
"operatorName": "SpiceJet",
"flightNumber": "386",
"attr": {
"baggage": "15 Kg",
"availableSeats": "9",
"isRefundable": true,
"bookingClass": "U",
"cabinClass": "Economy Class"
},
"bookingClass": "U"
}
],
[
{
"origin": {
"airportCode": "DEL",
"cityName": "Delhi",
"airportName": "Indira Gandhi International Airport",
"dateTime": "2025-12-25 22:00:00",
"terminal": "1",
"fdtv": 1766700000,
"timezoneOffset": "+05:30"
},
"destination": {
"airportCode": "BOM",
"cityName": "Mumbai",
"airportName": "Chhatrapati Shivaji International Airport",
"dateTime": "2025-12-26 00:10:00",
"terminal": "1",
"fatv": 1766707800,
"timezoneOffset": "+05:30"
},
"operatorCode": "SG",
"marketingCompany": "SG",
"displayOperatorCode": "SG",
"validatingAirline": "GP",
"operatorName": "SpiceJet",
"flightNumber": "169",
"attr": {
"baggage": "15 Kg",
"availableSeats": "9",
"isRefundable": true,
"bookingClass": "U",
"cabinClass": "Economy Class"
},
"bookingClass": "U"
}
]
]
},
"price": {
"currency": "INR",
"totalDisplayFare": 21892.4,
"priceBreakup": {
"basicFare": 17280.0,
"tax": 4612.4,
"commissiontype": "domestic"
},
"passengerBreakup": {
"adt": {
"basePrice": 17280.0,
"tax": 4612.4,
"totalPrice": 21892.4,
"passengerCount": 1,
"flightAttr": {
"1": [
{
"availableSeats": "9",
"isRefundable": true,
"bookingClass": "U",
"cabinClass": "Economy Class"
}
],
"2": [
{
"availableSeats": "9",
"isRefundable": true,
"bookingClass": "U",
"cabinClass": "Economy Class"
}
]
}
}
}
},
"resultToken": "93053385a6db08cfcfb22454dcfa425bb3676021$137e3ae7c11d48c463b5d055b32e287b819c99ee",
"attr": {
"isRefundable": true
}
}
]
]
}
}
} Here each Flight Details contains 2 details. One for onward journey and second one for return journey. The price it returns is for both together. So while displaying the flights show onward and return both.

---

On the search result page, when "Select" button is clicked, it will show a new page with flight details, Fare summary (Base Fare(passenger wise), Taxes, Grand Total), if user has not logged in then it should give option to Book as guest by accepting email and mobile number. User should also have option to sign in.

When I selected 2 Adults, 1 child and 1 infant, total price under base fare is ok. But it says "Base Fare (1 Adult)"

In the same page, allow eCoupon or a deal code/promo code to be applied if anyone has?

Once "Continue as Guest" is clicked, keeping the flight details and Fare summary, ask user to enter the names of the passengers as on passport

Add a "Terms and Conditions" checkbox in same page which will enable Confirm Booking button
Once "Confirm Booking" is clicked, allow User to verify passenger names and Edit if needed.

---

## Once Confirm & Book is clicked, make a payment gateway API call. (Razorpay or HDFC)

Once "Confirm & Book" is clicked, we need to call Razorpay gateway to collect payment.

First call a Java API to get the Order ID.
Request -
URL : {{baseURL}}/vivapi-mt/flight/service/order-id-creation?resultToken=fa85c51e12884d5e432982a23b15079ab3e2ea5d$47c1126ffa46161c9fefa8712c260a5eb68d77c7

For RoundTrip URL = http://localhost:8080/vivapi-mt/flight/service/order-id-creation?resultToken=2f2de79b8cf787400acf78ad7745fc4ba3751e63$26bc64e7524d867de05ce74f376ce897df795ca3&returnResultToken=2f2de79b8cf787400acf78ad7745fc4ba3751e63$ba529a4ce55cfa88e5aaf31b7846ddb1810e6031&tripType=roundtrip

Passed Token is used to extract the amount to be collected by Razorpay.

Method : GET
Auth : Bearer Token(domain_currency Token)
No Body

Expected response:  
 {
"pgatewayOrderId": "order_Ri9fKff54FBL1z",
"pgateway": "Razorpay"
}

Now call Razorpay Gateway to collect the fund.

Extracts razorpay_order_id, razorpay_payment_id, and razorpay_signature from the response then call another Java API to validate the payment.

Request:
URL: {{baseURL}}/vivapi-mt/flight/service/order-payment-validation
Method : POST
Auth : Bearer Token(domain_currency Token)
Body {
"payId": "pay_OB876",
"orderId": "order_Ri9fKff54FBL1z",
"signature": "64312895eb91126b79304462a6572d4c2aba0f4e24345fd50f8e40267ec00273"
}

Need to call few API call before coming to payment screen. Here is the flow -
In the home page when "Search Flights" button is called. Second page is displayed with the results obtained from search API. On this page when a flight is selected by clicking "Select" button, it needs to call an API -
URL=${API_BASE_URL}/vivapi-mt/flight/service/update-fare-quote.
Auth with Bearer Token (domain currency token)
Header with X-API-KEY
POST Method
Body = {
"ResultToken":"8f70416dac68b6d341b033764f06eaa76e695820$5af4b4e395ce56bfe27b8e4f99f09f41af2a12f0"
}
Here ResultToken is taken from the flight that will be selected.
The response will be like - {
"Status": 1,
"Message": "",
"UpdateFareQuote": {
"FareQuoteDetails": {
"JourneyList": {
"FlightDetails": {
"Details": [
[
{
"Origin": {
"AirportCode": "BOM",
"CityName": "Mumbai",
"AirportName": "Chhatrapati Shivaji International Airport",
"DateTime": "2025-12-24 22:55:00",
"Terminal": "2",
"FDTV": 1766616900,
"TimezoneOffset": "+05:30"
},
"Destination": {
"AirportCode": "DEL",
"CityName": "Delhi",
"AirportName": "Indira Gandhi International Airport",
"DateTime": "2025-12-25 00:15:00",
"Terminal": "3",
"FATV": 1766621700,
"TimezoneOffset": "+05:30"
},
"OperatorCode": "AI",
"marketingCompany": "AI",
"MarketingCompany": "AI",
"DisplayOperatorCode": "AI",
"ValidatingAirline": "AI",
"OperatorName": "AIR INDIA",
"FlightNumber": "2950",
"CabinClass": null,
"Operatedbyairline": null,
"Operatedbyairlinename": null,
"Duration": null,
"Attr": {
"Baggage": "15 Kg",
"CabinBaggage": null,
"AvailableSeats": "9",
"IsRefundable": false,
"AirlineRemark": null,
"IsLCC": null,
"BookingClass": "V",
"CabinClass": "Economy Class",
"FareType": null,
"AvailabilityCnxType": null,
"ChangeFee": null,
"CancellationFee": null,
"Currency": null
},
"stop_over": null,
"bookingClass": "V",
"AirlinePNR": null,
"airlinePNR": null
}
]
]
},
"Price": {
"Currency": "INR",
"TotalDisplayFare": 9663.33,
"PriceBreakup": {
"BasicFare": 8311.0,
"Tax": 1352.33,
"AgentCommission": null,
"AgentTdsOnCommision": null,
"CommissionType": "domestic"
},
"PassengerBreakup": {
"ADT": {
"BasePrice": 8311.0,
"Tax": 1352.33,
"TotalPrice": 9663.33,
"PassengerCount": 1,
"FlightAttr": {}
},
"CHD": {
"BasePrice": 0.0,
"Tax": 0.0,
"TotalPrice": 0.0,
"PassengerCount": null,
"FlightAttr": {}
},
"INF": {
"BasePrice": 0.0,
"Tax": 0.0,
"TotalPrice": 0.0,
"PassengerCount": null,
"FlightAttr": {}
}
}
},
"ResultToken": "e9982360fa1fd72549070042c6cc26f1827a8d63$6882c5b0051c04b30cdd0cfd9b6fe166b724facd",
"Attr": {
"Baggage": null,
"CabinBaggage": null,
"AvailableSeats": null,
"IsRefundable": false,
"AirlineRemark": null,
"IsLCC": null,
"BookingClass": null,
"CabinClass": null,
"FareType": null,
"AvailabilityCnxType": null,
"ChangeFee": null,
"CancellationFee": null,
"Currency": null
}
}
}
}
}
The next page should display the data received from this response.

## Once Razorpay payment is successful. Call below API

Request -
URL : {{baseURL}}/vivapi-mt/flight/service/commit-booking
Method : POST
Auth : Bearer Token(domain_currency Token)
Body :
{
"AppReference": "FB21-812255-318889",
"SequenceNumber": 0,
"ResultToken": "<Result Token used in update-fare-quote request>",
"Passengers": [
{
"IsLeadPax": "1",
"Title": "Mr",
"FirstName": "Lal",
"LastName": "sdfsdManidfsdfs",
"PaxType": "1",
"Gender": "1",
"DateOfBirth": "1970-01-01",
"PassportNumber": "1649207720",
"PassportExpiry": "2028-07-21",
"CountryCode": "IN",
"CountryName": "India",
"ContactNo": "32323232323",
"City": "Bangalore",
"PinCode": "560100",
"AddressLine1": "2nd Floor, Venkatadri IT Park, HP Avenue,, Konnappana Agrahara, Electronic city",
"AddressLine2": "2nd Floor, Venkatadri IT Park, HP Avenue,, Konnappana Agrahara, Electronic city",
"Email": "ticket-airlines@vivancetravels.com"
}
]
}

Expected response:  
 {
"Status": "1",
"Message": "",
"CommitBooking": {
"BookingDetails": {
"BookingId": null,
"PNR": "7RLA63",
"GDSPNR": null,
"PassengerDetails": [
{
"PassengerId": null,
"TicketId": null,
"PassengerType": "ADT",
"Title": null,
"FirstName": "LAL",
"LastName": "SDFSDMANIDFSDFS",
"PassportNumber": null,
"TicketNumber": "2792760931",
"DateOfBirth": null
}
],
"JourneyList": {
"FlightDetails": {
"Details": [
[
{
"Origin": {
"AirportCode": "BOM",
"CityName": "Mumbai",
"AirportName": "Chhatrapati Shivaji International Airport",
"DateTime": "241225 2255",
"Terminal": "2",
"FDTV": 1,
"TimezoneOffset": null
},
"Destination": {
"AirportCode": "DEL",
"CityName": "Delhi",
"AirportName": "Indira Gandhi International Airport",
"DateTime": "251225 0015",
"Terminal": "3",
"FATV": 1,
"TimezoneOffset": null
},
"OperatorCode": "AI",
"marketingCompany": null,
"MarketingCompany": null,
"DisplayOperatorCode": "1A",
"ValidatingAirline": null,
"OperatorName": "1A",
"FlightNumber": "2950",
"CabinClass": "M",
"Operatedbyairline": null,
"Operatedbyairlinename": null,
"Duration": null,
"Attr": {
"Baggage": null,
"CabinBaggage": null,
"AvailableSeats": null,
"IsRefundable": null,
"AirlineRemark": null,
"IsLCC": null,
"BookingClass": null,
"CabinClass": null,
"FareType": null,
"AvailabilityCnxType": null,
"ChangeFee": "3000",
"CancellationFee": "5000",
"Currency": "INR"
},
"stop_over": null,
"bookingClass": null,
"AirlinePNR": "7RLA63",
"airlinePNR": "7RLA63"
}
]
]
},
"Price": null,
"ResultToken": null,
"Attr": null
},
"Price": {
"Currency": "INR",
"TotalDisplayFare": 9663.33,
"PriceBreakup": {
"BasicFare": 8311.0,
"Tax": 1352.33,
"AgentCommission": null,
"AgentTdsOnCommision": null,
"CommissionType": "domestic"
},
"PassengerBreakup": {
"ADT": {
"BasePrice": 8311.0,
"Tax": 1352.33,
"TotalPrice": 9663.33,
"PassengerCount": 1,
"FlightAttr": {}
},
"CHD": {
"BasePrice": 0.0,
"Tax": 0.0,
"TotalPrice": 0.0,
"PassengerCount": null,
"FlightAttr": {}
},
"INF": {
"BasePrice": 0.0,
"Tax": 0.0,
"TotalPrice": 0.0,
"PassengerCount": null,
"FlightAttr": {}
}
}
},
"Attr": null
}
}
}

# show ticket

Once commit-booking is successful, call (To Get Ticket Details )
{{baseURL}}/vivapi-user/flight-booking/show/FB21-812255-318889
PUT Method
No Body

Expected RESPONSE : {
"response": {
"existingFlightBookingDetails": [
{
"origin": 462,
"domainOrigin": 1,
"status": "BOOKING_CONFIRMED",
"appReference": "FB29-053847-178777",
"bookingSource": "PTBSID0000000002",
"tripType": "oneway",
"phone": "1122334455",
"alternateNumber": "",
"email": "mailto:lalmanip@gmail.com",
"journeyStart": "2024-12-29T20:20:00.000+00:00",
"journeyEnd": "2024-12-30T03:00:00.000+00:00",
"journeyFrom": "Mumbai (BOM)",
"journeyTo": "Delhi (DEL)",
"fromLoc": "BOM",
"toLoc": "DEL",
"cabinClass": "Economy",
"paymentMode": "PNHB1",
"convinenceValue": null,
"convinenceValueType": null,
"convinencePerPax": null,
"convinenceAmount": null,
"discount": 0.0,
"promoCode": "",
"currency": "INR",
"currencyConversionRate": 1.0,
"attributes": "{&quot;country&quot;:&quot;India&quot;,&quot;city&quot;:&quot;Bangalore&quot;,&quot;zipcode&quot;:&quot;560100&quot;,&quot;address&quot;:&quot;2nd Floor, Venkatadri IT Park, HP Avenue,, Konnappana Agrahara, Electronic city&quot;}",
"gstDetails": "&quot;1&quot;",
"createdById": 2110,
"subAgentId": 0,
"createdDatetime": "2024-10-29T09:38:47.000+00:00"
}
],
"flightBookingItineraryDetails": [
{
"origin": 642,
"appReference": "FB29-053847-178777",
"airlinePnr": "NKL4M6",
"segmentIndicator": true,
"airlineCode": "UK",
"airlineName": "Air Vistara",
"flightNumber": "966",
"fareClass": "Economy Class",
"fromAirportCode": "AMD",
"fromAirportName": "Ahmedabad Airport",
"toAirportCode": "DEL",
"toAirportName": "Indira Gandhi International Airport",
"departureDatetime": "2024-12-30T01:15:00.000+00:00",
"arrivalDatetime": "2024-12-30T03:00:00.000+00:00",
"cabinBaggage": null,
"checkinBaggage": "15 Kg",
"isRefundable": "Refundable",
"status": "BOOKING_CONFIRMED",
"operatingCarrier": "UK",
"fareRestriction": "",
"fareBasisCode": "",
"fareRuleDetail": "",
"attributes": "{&quot;departure_terminal&quot;:&quot;1&quot;,&quot;arrival_terminal&quot;:&quot;3&quot;,&quot;CabinClass&quot;:&quot;M&quot;,&quot;Attr&quot;:{&quot;Baggage&quot;:null,&quot;CabinBaggage&quot;:null,&quot;AvailableSeats&quot;:null,&quot;IsRefundable&quot;:null,&quot;AirlineRemark&quot;:null,&quot;IsLCC&quot;:null,&quot;BookingClass&quot;:null,&quot;CabinClass&quot;:null,&quot;FareType&quot;:null,&quot;AvailabilityCnxType&quot;:null,&quot;ChangeFee&quot;:null,&quot;CancellationFee&quot;:null,&quot;Currency&quot;:null}}",
"notes": null,
"createdDateTime": "2024-10-29T00:08:47.000+00:00"
}
],
"flightBookingTransactionDetails": [
{
"origin": 7,
"appReference": "FB29-053847-178777",
"pnr": "NKL4M6",
"status": "BOOKING_CONFIRMED",
"statusDescription": null,
"bookId": null,
"gdsPnr": "NKL4M6",
"source": null,
"refId": null,
"totalFare": null,
"adminCommission": null,
"agentCommission": null,
"adminTds": null,
"agentTds": null,
"adminMarkup": null,
"agentMarkup": null,
"gst": null,
"currency": null,
"getbookingStatusCode": null,
"getbookingDescription": null,
"getbookingCategory": null,
"attributes": null,
"sequenceNumber": null,
"holdTicketReqStatus": null,
"createdDatetime": null
}
],
"flightBookingPassengerDetails": [
{
"origin": 633,
"appReference": "FB29-053847-178777",
"flightBookingTransactionDetailsFk": 479,
"passengerType": "Adult",
"isLead": 1,
"title": "Mr",
"firstName": "Lalmani",
"middleName": "",
"lastName": "Prasad",
"dateOfBirth": null,
"gender": "Male",
"passengerNationality": "India",
"passportNumber": "9220576379",
"PassportIssueCountryCode": "India",
"passportExpiryDate": "2029-10-29",
"status": "BOOKING_CONFIRMED",
"attributes": "[]",
"createdDatetime": "2024-10-29T00:08:47.000+00:00"
}
],
"flightCancellationDetails": [],
"flightBookingBaggageDetails": [],
"flightBookingMealDetails": []
},
"message": null,
"status": "Success"
}

Instead of saying ticket details will be sent via email, display that ticket details in UI also using the response received from ticket details API .
In that case you can call another API - {{baseURL}}/vivapi-user/flight-booking/print/FB29-053847-178777 (GET method). This API will return a pdf. Just display that pdf on the screen.

# 24th March 2026

When User clicks on Forget Password Link. Frontend will call {{baseURL}}/vivapi-user/user/forgotpasswd
Sample req: {
"email" : "createuser25@gmail.com"
}

Backend Logic:
Check if user exists
Generate token
Save token + expiry in DB
Respond to the caller

Sample Resp: {
"response": {
"userId": 45,
"userType": 4,
"email": "createuser25@gmail.com",
"userName": "CreateUser25",
"password": "zaq12wsx",
"status": 0,
"firstName": "Createpachis",
"middleName": null,
"lastName": "Userpachis",
"countryCode": 92,
"phone": null,
"emailActivation": false,
"createdBy": null,
"createdOn": "2025-03-17T01:49:10.135+00:00",
"modifiedBy": null,
"modifiedOn": "2025-03-17T01:50:11.090+00:00",
"title": null,
"gender": null,
"pwdToken": "dd727192-6298-4c40-8204-c580b9fab20b",
"pwdTokenExpiry": "2026-03-24T00:29:40.334"
},
"message": "If an account exists, a reset link has been sent",
"status": "success"
}

Fronend will now pop up a message - "If an account exists, a reset link has been sent"

If the response from backend has status = "success", Frontend will send email to provided email address with a reset link - https://yourfrontend.com/reset-password?token=abc123 (get the token from above response)
Also mention, the link will expire in 30 minutes.

Now when the user hits the URL, The URL will lead to frontend, the frontend will extract the token from url and ask for New password. Now token and new password should be sent to backend to verify if token expired or not and if not, update the new password in DB.

To reset, call API - {{baseURL}}/vivapi-user/user/reset
sample req: {
"pwdToken": "1d2779d4-c0b9-4288-8400-ebb01220f3fa",
"password" : "zaq12wsx90"
}

sample resp:
{
"response": {
"userId": 45,
"userType": 4,
"email": "createuser25@gmail.com",
"userName": "CreateUser25",
"password": "zaq12wsx90",
"status": 0,
"firstName": "Createpachis",
"middleName": null,
"lastName": "Userpachis",
"countryCode": 92,
"phone": null,
"emailActivation": false,
"createdBy": null,
"createdOn": "2025-03-17T01:49:10.135+00:00",
"modifiedBy": null,
"modifiedOn": "2025-03-17T01:50:11.090+00:00",
"title": null,
"gender": null,
"pwdToken": "1d2779d4-c0b9-4288-8400-ebb01220f3fa",
"pwdTokenExpiry": "2026-03-24T01:08:08.9825"
},
"message": null,
"status": "success"
}

# My Bookings

Get all bookings through Email address
GET Method : http://localhost:8082/vivapi-user/flight-booking/getMyAllBookings/createuser26@gmail.com
Request : NO BODY
Sample Response: "response": [
{
"flightBookingDetails": {
"origin": 624,
"domainOrigin": 1,
"status": "BOOKING_CONFIRMED",
"appReference": "JS25-68905751-402983",
"bookingSource": "NEXTJSD00000000020",
"bookingId": null,
"tripType": null,
"phone": "1122334455",
"alternateNumber": "5544332211",
"email": "lal@gmail.com",
"journeyStart": "2026-04-22T19:00:00.000+00:00",
"journeyEnd": "2026-04-22T20:30:00.000+00:00",
"journeyFrom": null,
"journeyTo": null,
"fromLoc": "DEL",
"toLoc": "VNS",
"cabinClass": "Economy",
"paymentMode": "PNHB1",
"convinenceValue": null,
"convinenceValueType": null,
"convinencePerPax": null,
"convinenceAmount": null,
"discount": null,
"promoCode": null,
"currency": null,
"currencyConversionRate": null,
"attributes": null,
"gstDetails": null,
"createdById": 0,
"subAgentId": null,
"createdOn": "2026-04-07T13:35:13.000+00:00",
"modifiedOn": null,
"createdBy": null,
"modifiedBy": null
},
"flightBookingTransactionDetails": [
{
"origin": 574,
"appReference": "JS25-68905751-402983",
"pnr": null,
"status": null,
"statusDescription": null,
"bookId": "default",
"gdsPnr": null,
"source": null,
"refId": null,
"totalFare": null,
"adminCommission": null,
"agentCommission": null,
"adminTds": null,
"agentTds": null,
"adminMarkup": null,
"agentMarkup": null,
"gst": null,
"currency": null,
"getbookingStatusCode": null,
"getbookingDescription": null,
"getbookingCategory": null,
"attributes": {
"Fare": {
"Currency": "INR",
"BaseFare": 4750,
"Tax": 947.5,
"PublishedFare": 5697.5,
"AgentCommission": 0,
"AgentTdsOnCommision": 0,
"OfferedFare": 5697.5
}
},
"sequenceNumber": null,
"holdTicketReqStatus": null,
"createdOn": "2026-04-07T13:35:13.000+00:00",
"modifiedOn": null,
"createdBy": null,
"modifiedBy": null
}
],
"flightBookingItineraryDetails": [
{
"origin": null,
"appReference": "JS25-68905751-402983",
"airlinePnr": "WZG34D",
"segmentIndicator": 0,
"airlineCode": "6E",
"airlineName": "AIR INDIA",
"flightNumber": "001",
"fareClass": "Economy",
"fromAirportCode": "DEL",
"fromAirportName": "Varanasi",
"toAirportCode": "VNS",
"toAirportName": null,
"departureDatetime": "2026-04-22T19:00:00.000+00:00",
"arrivalDatetime": "2026-04-22T20:30:00.000+00:00",
"cabinBaggage": "DEFAULT",
"checkinBaggage": "15KG",
"isRefundable": "Non Refundable",
"status": null,
"operatingCarrier": "AI",
"currency": "INR",
"changeFee": null,
"cancellationFee": null,
"fareRestriction": null,
"fareBasisCode": null,
"fareRuleDetail": null,
"createdBy": null,
"modifiedBy": null,
"attributes": null,
"notes": null,
"createdOn": null,
"modifiedOn": null
}
],
"flightBookingPassengerDetails": [
{
"origin": 675,
"appReference": "JS25-68905751-402983",
"flightBookingTransactionDetailsFk": null,
"passengerType": "Adult",
"isLead": null,
"title": "Mr",
"firstName": "lalmani",
"middleName": null,
"lastName": "prasad",
"dateOfBirth": "1990-01-01T00:00:00",
"gender": null,
"passengerNationality": null,
"passportNumber": null,
"PassportIssueCountryCode": null,
"passportExpiryDate": null,
"status": null,
"attributes": null,
"createdOn": "2026-04-07T13:35:13.000+00:00",
"modifiedOn": null,
"createdBy": null,
"modifiedBy": null,
"flightBookingBaggageDetailsList": null,
"flightBookingSeatDetailsList": null,
"flightBookingMealDetailsList": null,
"flightCancellationDetailsList": null,
"flightPassengerTicketInfoList": null
}
],
"businessInfo": null
}
],
"message": null,
"status": "Success"
}

# Student Fare and Senior citizen discount

We have implemented Student Fare for 6E(Indigo), SG(SpiceJet), I5(AirAsia) & GDS:

Service URL (REST) to be used:
http://api.tektravels.com/BookingEngineService_Air/AirService.svc/rest/Search
Client need to pass 'ResultFareType' node to get the Student fare and below are the enums for the same-

RegularFare: 2
ResultFareType:3 (StudentFare )
ResultFareType:4 (Armed Force)
ResultFareType:5 (Senior Citizen)

####

GDS ==> Galileo, Amadeus
NDC Airlines ==> Emirates (EK), Lufthansa (LH), Oman Air (WY), Etihad Airways (EY), Gulf Air (GF), Air India (AI) ,Amadeus NDC
LCC Airlines ==> IndiGo (6E), Air India Express (IX), SpiceJet (SG), Fly Dubai (FZ), Akasa Air (QP)

# The flow of passing request in Air API.

For LCC
Search-->FareRule-->FareQuote-->SSR(optional)-->Ticket-->GetBookingDetails.

For Non-LCC
Search-->FareRule-->FareQuote-->SSR(optional)-->Book-->Ticket-->GetBookingDetails.
==================================
What is the Meanings of Ticket Status
1.     Failed = 0 If you have received status as failed 0 , then your booking has not been made and failed due to any reason so in this case we request you to call get booking details method to verify the exact status of your ticket.

2.     Successful = 1 Your ticket has been created successfully.

3.     NotSaved = 2  Your ticket has not been saved due to any reason and in this case you can call our operation team and also call get booking details method to verify the exact status of your ticket.

4.     NotCreated = 3 Your ticket has not been created due to any reason and in this case you can call our operation team and also call get booking details method to verify the exact status of your ticket.

5.     NotAllowed = 4 This error comes from supplier end so you need to contact us

6.     InProgress = 5   your ticket is in progress state so in this case we request you to call get booking details method to verify the exact status of your ticket

7.     TicketeAlreadyCreated= 6 This ticket is already created with Same PNR.

8.     PriceChanged = 8 in this case you would have received “IsPriceChanged”: True in book or ticket response so you need to pass same request again with updated price.

9.     OtherError = 9 In this case please send us request and response logs and will check same and update you reason for the error.

# ##############
Journey type (1 - OneWay, 2 - Return, 3 - Multi Stop, 4 - AdvanceSearch, 5 - Special Return)
