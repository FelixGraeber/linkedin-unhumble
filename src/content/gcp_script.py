import os
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import anthropic
import base64
import requests
from PIL import Image
import io
import time

# Initialize Flask app
app = Flask(__name__)

# Apply CORS to all domains on all routes, allowing all headers and methods.
# Updated to handle CORS options more explicitly
@app.after_request
def after_request(response):
    header = response.headers
    header['Access-Control-Allow-Origin'] = '*'
    header['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    header['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

def prepare_image(image_url):
    """Fetch, resize to 500px on the longer side, convert to JPEG, and base64 encode the image."""
    try:
        print(f"Preparing image from URL: {image_url}")
        image_media_type = "image/jpeg"
        response = requests.get(image_url)
        print("Image fetched successfully.")
        # Open the image using BytesIO
        image = Image.open(io.BytesIO(response.content))
        print(f"Image opened. Initial format: {image.format}, size: {image.size}, mode: {image.mode}")
        # Convert image to RGB if it's not already in a compatible format
        if image.mode in ["P", "RGBA"]:
            image = image.convert("RGB")
            print("Image converted to RGB.")
        # Calculate new size, keeping the aspect ratio
        if image.width > image.height:
            new_height = int((500 / image.width) * image.height)
            new_size = (500, new_height)
        else:
            new_width = int((500 / image.height) * image.width)
            new_size = (new_width, 500)
        print(f"Resizing image to new size: {new_size}")
        # Resize the image
        resized_image = image.resize(new_size, Image.Resampling.LANCZOS)
        print("Image resized successfully.")
        # Convert the image to JPEG
        with io.BytesIO() as output:
            resized_image.save(output, format="JPEG")
            jpeg_data = output.getvalue()
        print("Image converted to JPEG.")
        # Base64 encode the JPEG image
        image_data = base64.b64encode(jpeg_data).decode("utf-8")
        print("Output: Image base64 encoded successfully: %s" % image_data)
        print("Output: Image media type: %s" % image_media_type)
        return image_data, image_media_type
    except Exception as e:
        print(f"Failed to prepare image from URL {image_url}: {str(e)}")
        return None, None

def parse_request_data(request):
    """Parse and validate request data."""
    data = request.get_json()
    if not data:
        return None, "No JSON payload provided"
    messages = data.get('data', {}).get('messages', [])
    if not messages:
        return None, "No messages found in payload"
    return data, None

def process_classification_request(data):
    """Process the classification request."""
    model = data.get('data', {}).get('model', 'claude-3-haiku-20240229')
    messages = data.get('data', {}).get('messages', [])
    first_message = messages[0]
    image_url = first_message.get('content', [])[0].get('source', {}).get('url')
    classification_request = first_message.get('content', [])[1].get('text')
    print("Classification request: %s" % classification_request)
    image_data, image_media_type = prepare_image(image_url)
    print("Image data: %s" % image_data)
    print("Image media type: %s" % image_media_type)
    if not image_data or not image_media_type:
        return None, "Failed to prepare image"
    return (model, messages, image_data, image_media_type, classification_request), None

def send_classification_request(model, image_data, image_media_type, classification_request):
    """Send the classification request to the Anthropic API with exponential backoff for rate limiting."""
    print("Sending classification request to Anthropic API.")
    client = anthropic.Anthropic(api_key=os.getenv('API_KEY'))
    print("Anthropic client initialized.")
    print("API key: %s" % os.getenv('API_KEY'))
    backoff_time = 1  # Start with 1 second
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": image_media_type,
                                    "data": image_data,
                                },
                            },
                            {
                                "type": "text",
                                "text": classification_request
                            }
                        ],
                    }
                ],
            )
            print("Classification request sent successfully, response: %s" % response)
            return response, None
        except anthropic.exceptions.RateLimitException:
            print(f"Rate limit exceeded, retrying in {backoff_time} seconds...")
            time.sleep(backoff_time)
            backoff_time *= 2  # Exponential backoff
        except Exception as e:
            print(f"Failed to send classification request to Anthropic API: {str(e)}")
            return None, str(e)
    print("Max attempts reached, failed to send classification request.")
    return None, "Max attempts reached, failed to send classification request."

@app.route('/classify_image', methods=['POST', 'OPTIONS'])
def classify_image(request):  # Removed the request parameter here
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    elif request.method == 'POST':
        print("Request received: %s" % request.method)
        data, error = parse_request_data(request)
        if error:
            return jsonify({"error": error}), 400
        classification_data, error = process_classification_request(data)
        if error:
            return jsonify({"error": error}), 500

        model, messages, image_data, image_media_type, classification_request = classification_data
        print("Model: %s" % model)
        print("Messages: %s" % messages)
        print("Image data: %s" % image_data)
        print("Image media type: %s" % image_media_type)
        print("Classification request: %s" % classification_request)
        response, error = send_classification_request(model, image_data, image_media_type, classification_request)
        print("Response: %s" % response)
        if error:
            return jsonify({"error": error}), 500

        response_dict = {
            "id": response.id,
            "content": [{"text": block.text, "type": block.type} for block in response.content],
            "model": response.model,
            "role": response.role,
            "stop_reason": response.stop_reason,
            "type": response.type,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        }
        print("Response dictionary: %s" % response_dict)
        return _corsify_actual_response(jsonify(response_dict)), 200
    else:
        return jsonify({"error": "Method not allowed"}), 405

def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add('Access-Control-Allow-Headers', '*')
    response.headers.add('Access-Control-Allow-Methods', '*')
    return response

def _corsify_actual_response(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    """Global error handler."""
    response = jsonify({'message': 'An unexpected error occurred', 'details': str(error)})
    response.status_code = 500
    return _corsify_actual_response(response)

def main():
    print("Received request at main entry point.")
    return app


if __name__ == '__main__':
    print("Server is running...")
    app.run(port=50001, debug=True)