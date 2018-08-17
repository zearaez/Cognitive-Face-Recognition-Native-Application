import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Camera, CameraOptions } from '@ionic-native/camera';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  //base64 format image 
  public image:string;

  // Eerror message that is shown when something goes wrong
  public error:string;

  //For loading effect and tool
  public loading:boolean;

  //For value after analyse using Cognitive Service
  public analysis:Array<object> = [];

  //imgur endpoint to upload base64 format image and get image url
  public IMGUR_ENDPOINT:string = "https://api.imgur.com/3/image";

  //imgur client ID for authenticate and access our account 
  public IMGUR_CLIENT_ID:string = "3334becfd3e907c";

  //Endpoint for analyse image using Microsoft Azure
  // public AZURE_ENDPOINT:string = "https://westcentralus.api.cognitive.microsoft.com/face/v1.0";
  public AZURE_ENDPOINT:string = "https://centralindia.api.cognitive.microsoft.com/face/v1.0";
  //Azure face API key
  public AZURE_API_KEY:string = "674d4ec1cdd54ad5a980902ed14d4bff";

  //camera options
  private options:CameraOptions = {
    destinationType: this.camera.DestinationType.DATA_URL,
    encodingType: this.camera.EncodingType.JPEG,
    mediaType: this.camera.MediaType.PICTURE,
    targetWidth: 600,
    targetHeight: 600,
    saveToPhotoAlbum: false,
    allowEdit: true,
    sourceType: 1,
    correctOrientation: false,
    cameraDirection: 1
  };
  constructor(public navCtrl: NavController, public camera:Camera) {

  }

  //Take photo will capture image from our device
  public takePhoto(taken:Function = null, notTaken:Function = null):void {
    this.camera.getPicture(this.options).then((imageData) => {
          // For the sake of displaying our image, we have to add a
          // data type to our base64 encoding. We'll snip this out later
          // when retrieving a link from Imgur.
          let base64Image:string = 'data:image/jpeg;base64,' + imageData;
          if (taken != null) taken(base64Image);
    }, (e) => {
          if (notTaken != null) notTaken(e);
    });
  }

  //send base64 image to imgur to get image URL
  public sendToImgur(image:string, urlCallback:Function = null, failureCallback:Function = null):void {
    image = image.substring(image.indexOf('base64,') + 'base64,'.length);

    // Imgur requires this string for authentication
    let auth:string = `Client-ID ${this.IMGUR_CLIENT_ID}`;

    // Imgur wants an encoded form-data body
    let body:FormData = new FormData();
    body.append('image', image);

    // Create a POST request and authorize us via our auth variable from above
    var xhr = new XMLHttpRequest();
    xhr.open("POST", this.IMGUR_ENDPOINT, true);
    xhr.setRequestHeader("Authorization", auth);

    // Once the request is sent, we check to see if it's successful
    xhr.onreadystatechange = () => {
          if (xhr.readyState == XMLHttpRequest.DONE) {
                // 200 is a successful status code, meaning it worked!
                if (xhr.status == 200) {
                      // We can grab the link from our HTTP response and call it back
                      let link = JSON.parse(xhr.response)['data']['link'];
                      if (urlCallback != null && link != null) {
                            urlCallback(link);
                      }
                } else if (xhr.status >= 400 && failureCallback != null) {
                      // If we receive a bad request error, we'll send our failure callback.
                      failureCallback();
                }
          }
    }

    // This synchronously sends our form-data body.
    xhr.send(body);
  }

  public analyzeViaAzure(link:string, analysisCallback:Function = null, failureCallback:Function = null):void {
    //Face parameter
    let faceParameters:object = {
          "returnFaceId": "true",
          "returnFaceLandmarks": "false",
          "returnFaceAttributes": "age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise",
    }

    // We use the above function, serialize, to serialize our face parameters.
    let serializedFaceParameters:string = Object.keys(faceParameters).map(key => key + '=' + faceParameters[key]).join('&');

    // Our body contains just one key, 'url', that contains our image link.
    // We must convert our body JSON into a string in order to POST it.
    let body = JSON.stringify({ "url": link });

    // Create a POST request with the serialized face parameters in our endpoint
    // Our API key is stored in the 'Ocp-Apim-Subscription-Key' header
    var xhr = new XMLHttpRequest();
    xhr.open("POST", `${this.AZURE_ENDPOINT}/detect?${serializedFaceParameters}`, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Ocp-Apim-Subscription-Key", this.AZURE_API_KEY);

    // Once the request is sent, we check to see if it's successful
    xhr.onreadystatechange = () => {
          if (xhr.readyState == XMLHttpRequest.DONE) {
                // 200 is a successful status code, meaning it worked!
                if (xhr.status == 200) {
                      // We can grab the link from our HTTP response and call it back
                      if (analysisCallback != null) {
                            analysisCallback(JSON.parse(xhr.response));
                      }
                } else if (xhr.status >= 400 && failureCallback != null) {
                      // If we receive a bad request error, we'll send our failure callback.
                      failureCallback();
                }
          }
    }

    xhr.send(body);
}


// Populate the analysis array from a Face API response object
public analyzeFaceDetails(response:object):void {
  // Clear analysis array.
  this.analysis = [];

  // Retrieved face attributes object from response.
  let attributes = response[0]['faceAttributes'];

  // Convert two strings into a key-value pair for our
  // analysis list.
  let getAnalysisObject = (feature, value) => {
        return { "feature": feature, "value": value };
  }

  // Converts 'john' into 'John'
  let capitalizeFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  //
  // ~ Analysis Time ~
  //

  // Get age
  this.analysis.push(getAnalysisObject("Age", attributes['age']));

  // Get age
  this.analysis.push(getAnalysisObject("Gender", capitalizeFirstLetter(attributes['gender'])));

  // Get smiling (person is smiling if value is over 0.5)
  this.analysis.push(getAnalysisObject("Smiling?", (attributes['smile'] > 0.5 ? "Yes" : "No")));

  // Check if bald, if so, output that.
  // If not, give the person's hair color.
  if (attributes['hair']['bald'] > 0.8) {
        this.analysis.push(getAnalysisObject("Is Bald?", "Yes"));
  } else if (attributes['hair']['hairColor'] && attributes['hair']['hairColor'].length > 0) {
        this.analysis.push(getAnalysisObject("Hair Color", capitalizeFirstLetter(attributes['hair']['hairColor'][0]['color'])));
  }

  // Get person's emotion by looping through emotion object and grabbing the greatest value
  let moods = attributes['emotion'];
  var greatestEmotion, greatestEmotionValue;
  for (var mood in moods) {
        if (moods[mood] && (!greatestEmotion || moods[mood] > greatestEmotionValue)) {
              greatestEmotion = mood;
              greatestEmotionValue = moods[mood];
        }
  }
  this.analysis.push(getAnalysisObject("Emotion", capitalizeFirstLetter(greatestEmotion)));

}

  public analyzeFace():void {
    this.error = null;
    this.takePhoto(
          // If photo was taken
          (photo) => {
                this.image = photo;
                this.loading = true;
                this.sendToImgur(photo,
                      // If Imgur returned an image link
                      (link) => {
                            this.analyzeViaAzure(link,
                                  // If analysis worked
                                  (response) => {
                                        //console.log(response);
                                        this.loading = false;
                                        this.analyzeFaceDetails(response);
                                  },
                                  // If analysis didn't work
                                  () => {
                                        this.loading = false;
                                        this.error = "Error: Azure couldn't analyze the photo.";
                                  }
                            )
                      },
                      // If Imgur didn't return an image link
                      () => {
                            this.error = "Error: Imgur couldn't return a link."
                      }
                )
          },
          // If photo wasn't taken
          () => {
                this.error = "Error: Phone couldn't take the photo.";
          }
    )
  }

}
