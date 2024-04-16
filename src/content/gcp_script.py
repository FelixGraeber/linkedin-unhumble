import os
import re
from flask import Flask, jsonify, make_response, request
from flask_cors import CORS, cross_origin
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import anthropic
import base64
import httpx
from cachetools import cached, TTLCache

# Initialize Flask app
app = Flask(__name__)

# Apply CORS to all domains on all routes, allowing all headers and methods.
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Initialize rate limiter
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["10 per minute"]
)

def is_valid_url(url):
    """Validate the URL format."""
    regex = re.compile(
        r'^(?:http|ftp)s?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return re.match(regex, url) is not None

# Cache for prepared images with a TTL of 5 minutes and a maximum size of 100 entries
image_cache = TTLCache(maxsize=100, ttl=300)

@cached(image_cache)
async def prepare_image(image_url):
    """Fetch, resize, convert to JPEG, and base64 encode the image."""
    try:
        if not is_valid_url(image_url):
            raise ValueError("Invalid URL format")
        image_media_type = "image/jpeg"
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url)
        image_data = base64.b64encode(response.content).decode("utf-8")
        return image_data, image_media_type
    except Exception as e:
        print("Failed to prepare image: %s" % str(e))
        return None, None

@app.route('/test', methods=['POST', 'OPTIONS'])
@cross_origin(origin='*', headers=['Content-Type', 'Authorization'])
@limiter.limit("5 per minute")
async def test(request):  # Added request parameter
    if request.method == 'OPTIONS':
        # Handle preflight request for CORS
        print("Handling CORS preflight for /test endpoint.")
        return make_response(jsonify(success=True), 200)

    # Simple static JSON response
    print("Received POST request at /test endpoint.")
    return jsonify({"status": "success", "message": "This is a test response"}), 200

@app.route('/classify_image', methods=['POST'])
@limiter.limit("20 per minute")
async def classify_image(request):
    # Use Flask's global request object directly
    print("Request received: %s" % request.method)
    if request.method == 'POST':
        print("Handling POST")
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        try:
            model = data.get('data', {}).get('model', 'claude-3-opus-20240229')
            messages = data.get('data', {}).get('messages', [])
            print("Messages: %s" % messages)
            print("Model: %s" % model)

            if messages:
                first_message = messages[0]
                image_url = first_message.get('content', [])[0].get('source', {}).get('url')
                classification_request = first_message.get('content', [])[1].get('text')
                if not is_valid_url(image_url):
                    return jsonify({"error": "Invalid image URL format"}), 400
                if not isinstance(classification_request, str):
                    return jsonify({"error": "Invalid classification request format"}), 400
                print("Image URL: %s" % image_url)
                print("Classification Request: %s" % classification_request)

                image_data, image_media_type = await prepare_image(image_url)
                if image_data and image_media_type:
                    client = anthropic.Anthropic(api_key=os.getenv('API_KEY'))
                    try:
                        response = await client.messages.create(
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
                        print("Response: %s" % response)
                        # Convert the Message object to a dictionary
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

                        return jsonify(response_dict), 200
                    except Exception as e:
                        # This catches exceptions thrown by the anthropic client, which might indicate errors like network issues or invalid parameters.
                        return jsonify({"error": str(e)}), 500
                else:
                    return jsonify({"error": "Failed to prepare image"}), 500
            else:
                return jsonify({"error": "No messages found in payload"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(Exception)
async def handle_unexpected_error(error):
    """Global error handler."""
    response = jsonify({'message': 'An unexpected error occurred', 'details': str(error)})
    response.status_code = 500
    return response

async def main(request):
    print("Received request at main entry point.")
    return await app(request)


if __name__ == '__main__':
    print("Server is running...")
    app.run(port=50001, debug=True)