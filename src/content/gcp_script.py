import os
import logging
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from openai import OpenAI
import requests
import time
from google.cloud import firestore

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv('CORS_ORIGINS', '*').split(',')}})

# Initialize Firestore
db = firestore.Client()

def parse_request_data(request):
    """Parse and validate request data."""
    logging.info(f"Received request data: {request.get_data()}")
    data = request.get_json()
    if not data:
        return None, "No JSON payload provided"
    logging.info(f"Parsed JSON data: {data}")
    messages = data.get('data', {}).get('messages', [])
    if not messages:
        return None, "No messages found in payload"
    return data, None

def process_classification_request(data):
    """Process the classification request."""
    model = data.get('data', {}).get('model', 'gpt-4o-mini')
    messages = data.get('data', {}).get('messages', [])
    first_message = messages[0] if messages else {}
    content = first_message.get('content', [])
    image_url = next((item.get('image_url', {}).get('url') for item in content if item.get('type') == 'image_url'), None)
    classification_request = next((item.get('text') for item in content if item.get('type') == 'text'), '')
    logging.info("Classification request: %s" % classification_request)
    logging.info("Image URL: %s" % image_url)
    if not image_url:
        return None, "No image URL provided"
    return (model, messages, image_url, classification_request), None

def send_classification_request(model, image_url, classification_request):
    """Send the classification request to the OpenAI API with exponential backoff for rate limiting."""
    logging.info("Sending classification request to OpenAI API.")
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    logging.info("OpenAI client initialized.")
    logging.info("API key: %s" % os.getenv('OPENAI_API_KEY'))
    backoff_time = 1  # Start with 1 second
    max_attempts = 5
    max_tokens = 1024  # Increased to accommodate more detailed reasoning
    classification_request = """
    Analyze the following image and provide a detailed reasoning about whether it's a self-promotional LinkedIn image. 
    Consider the following factors:
    1. Is there only one person in the image?
    2. Is the person taking up the majority of the image?
    3. Is the person posing in a very unnatural way?
    4. Does the image appear to be a professional headshot or selfie?
    5. Is the background neutral or related to a professional setting?

    Based on your analysis, classify the image as either 'selfpromotional_image' or 'other'.
    'selfpromotional_image' should be used if all or most of the above factors are true.
    'other' should be used for group images, images where the person is only a small portion, or non-person images.

    Provide your reasoning step by step, then give your final classification.
    Format your response as a JSON string with two keys: 'reasoning' (a string with your step-by-step analysis) and 'classification' (either 'selfpromotional_image' or 'other').
    """
    
    for attempt in range(max_attempts):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": classification_request
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url,
                                },
                            }
                        ],
                    }
                ],
                max_tokens=max_tokens,
            )
            logging.info("Classification request sent successfully, response: %s" % response)
            return response, None
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                logging.warning(f"Rate limit exceeded, retrying in {backoff_time} seconds...")
                time.sleep(backoff_time)
                backoff_time *= 2  # Exponential backoff
            else:
                logging.error(f"Failed to send classification request to OpenAI API: {str(e)}")
                return None, str(e)
        except Exception as e:
            logging.error(f"Failed to send classification request to OpenAI API: {str(e)}")
            return None, str(e)
    logging.error("Max attempts reached, failed to send classification request.")
    return None, "Max attempts reached, failed to send classification request."

@app.route('/classify_image', methods=['POST', 'OPTIONS'])
def classify_image(request):  # Add 'request' parameter here
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data, error = parse_request_data(request)
    if error:
        logging.error(f"Error parsing request data: {error}")
        return jsonify({"error": error}), 400

    classification_data, error = process_classification_request(data)
    if error:
        logging.error(f"Error processing classification request: {error}")
        return jsonify({"error": error}), 500

    model, messages, image_url, classification_request = classification_data
    response, error = send_classification_request(model, image_url, classification_request)
    if error:
        logging.error(f"Error sending classification request: {error}")
        return jsonify({"error": error}), 500

    try:
        if response.choices and response.choices[0].message.content:
            # Parse the JSON string from the API response
            import json
            result = json.loads(response.choices[0].message.content)
            reasoning = result.get('reasoning', '')
            classification_result = result.get('classification', '')

            # Firestore document handling
            doc_ref = db.collection('image_classifications').document(image_url)
            doc = doc_ref.get()
            if doc.exists:
                doc_ref.update({
                    'counter': firestore.Increment(1),
                    'last_classified': firestore.SERVER_TIMESTAMP,
                    'classification': classification_result,
                    'reasoning': reasoning
                })
                logging.info(f"Updated existing document for URL {image_url}")
            else:
                doc_ref.set({
                    'url': image_url,
                    'classification': classification_result,
                    'reasoning': reasoning,
                    'counter': 1,
                    'created_at': firestore.SERVER_TIMESTAMP
                })
                logging.info(f"Created new document for URL {image_url}")
        else:
            logging.error("No content found in response")
            return jsonify({"error": "No classification result found"}), 500
    except Exception as e:
        logging.error(f"Failed to process response: {str(e)}")
        return jsonify({"error": "Error processing response data"}), 500

    response_dict = {
        "url": image_url,
        "classification": classification_result,
        "reasoning": reasoning
    }
    return jsonify(response_dict), 200

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    """Global error handler."""
    response = jsonify({'message': 'An unexpected error occurred', 'details': str(error)})
    response.status_code = 500
    return response

def main():
    logging.info("Received request at main entry point.")
    return app

if __name__ == '__main__':
    logging.info("Server is running...")
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)