# nextjs_agent

Vivance Agent Module Application

# AI Bot prompt

You are an experienced nextjs developer. You have following requirement -

1.  Create a project for an agent module B2B application for a Travel domain where agent will have option to -
    Sign-in/Sign up on the first page.

        a) Sign-up: Sign-up form will have following fields to fill -
        	i) Personal Info: First Name *, Last Name *, Mobile Number *,Email *, Address Proof *(allow to upload proof), Country *, State *, City *,
        	ii) Company Details: Corporate ID *, Name of Sales Person *, Company Name *, PAN Number, PAN Card Holder Name, Address *, Pin Code *, Office Phone *, Establishment Date, Annual Transaction *, IATA, GST File (allow to upload file), PAN File (allow to upload file), No of Employee *
        	iii) Bank Details: Account Number *, IFSC Code *, Account Holder Name *
        	iv) Login Info: User Name *, Password *, Confirm Password *

        	Once these values are submitted, first it will call

        	{{baseURL}}/vivapi-user/user/create (POST) to create user credentials. The request would be like -

        	{

    "userType" : "4",
    "email" : <From Form>,
    "userName" : <From Form>,
    "password" : <From Form>,
    "status" : "0",
    "firstName": <From Form>,
    "lastName":<From Form>,
    "countryCode" : <From Form>,
    "emailActivation": false
    }

Once we get response, we call second API -

    	{{baseURL}}/vivapi-user/user/agent/add (POST method)

    	{
    "userId": <From previous API response>,

"userType": 3,
"address": <From Form>,
"addressProof": null,
"countryName": <From Form>,
"state": <From Form>,
"city": <From Form>,
"pinCode": <From Form>,
"companyName": <From Form>,
"panNumber": <From Form>,
"panFilePath": null,
"gstNumber": <From Form>,
"gstFilePath": null,
"officePhone": <From Form>,
"emailActivation": false

}

    b) Sign-in: This will allow authenticate user. Call authenticate API {{baseURL}}/vivapi-user/user/authenticate (POST)
    with username and password

## 2. After successful login, agent will be navigated to dashboard page where they can see their profile details and option to edit profile and change password.
