class libSerial {

  _address;
  _port;
  _timeout;
  _suppress_errors = false;
  constructor(port, address, timeout) {
    this._address = address;
    this._port = port;
    this._timeout = timeout;
  }

  async openPort(baudRate = 460800) {
    await _port.open({ baudRate: baudRate, flowControl: "hardware"});
    
    // Turn on Data Terminal Ready (DTR) signal.
    await _port.setSignals({ dataTerminalReady: false });

    // Turn off Request To Send (RTS) signal.
    await _port.setSignals({ requestToSend: false });
  
  }

  get port() {
    return this._port;
  }

  get address() {
    return this._address;
  }

  get timeout() {
    return this._timeout;
  }

  set timeout(val){
    this._timeout = val;
  }

  async _readStream(reader,timeout_len = 750,msg_len = 10) {
        let bytesReceived = 0;
        let offset = 0;
        let buffer = new ArrayBuffer(msg_len);
        let result = "";
        let success = false;

        let output = reader
          .read(new Uint8Array(buffer, offset, buffer.byteLength - offset))
          .then(function processText({ done, value }) {

            if(!done){
              buffer = value.buffer;
              offset += value.byteLength;
              bytesReceived += value.byteLength;

              result += value;

              //Check if expected message is received
              if (bytesReceived == msg_len) {
                done = true;
                success = true;
                return buffer;
              }
              //Continue reading
              return reader
                .read(new Uint8Array(buffer, offset, buffer.byteLength - offset))
                .then(processText);

            }

            return buffer;

          });

      function getTimeoutPromise(rdr, timeout, suppress_errors){
        return new Promise( (resolve, reject) => {
          setTimeout(() => {
            if( !success ){
              if( (timeout > 5) && !suppress_errors){
                console.log("timeout occured when waiting for response");
              }
               rdr.releaseLock();
               resolve("Timeout");
            }
          },timeout);
        });
      }

      const timeoutPromise = getTimeoutPromise(reader,timeout_len, this._suppress_errors);

      timeoutPromise.then( (message) => {
         if((timeout_len > 5) && !this._suppress_errors){
          console.log("timeoutPromise: " + message);
          }
        }
       );


      return output;
    };

  async writeAndRead(payload) {
    //BEGIN WRITE
    try{
      await this.flush();
    }
    catch(e){}
    const _writer = this._port.writable.getWriter();
    try {

    await _writer.write(payload);

    } catch (w_error) {
      console.log("Write error: " + w_error);

    } finally {
      _writer.releaseLock();

    }

    //BEGIN READ
    const _reader = this._port.readable.getReader({ mode: "byob" });
    try {
      let response = "";

      
      response = await this._readStream(_reader,this._timeout);
      _reader.releaseLock();
            
      return new DataView(response,0);

    } catch(r_error) {
      if(!this._suppress_errors){
        console.log("Read error: " + r_error);
      }
    } finally {
      _reader.releaseLock();
    }
  }

  async flush(){
    const _reader = this._port.readable.getReader({ mode: "byob" });
    try {
      let response = "";
      //Timeout set to one, to quickly flush all remaining bytes
      response = await this._readStream(_reader,1);
      return new DataView(response,0);

    } catch(r_error) {
      //Will automatically cause error due to quick timeout.
    } finally {
      _reader.releaseLock();
    }
  }
}