import React, { useContext } from 'react'
import {Context} from "../../main"
import { FaGithub, FaLinkedin } from "react-icons/fa"
import { SiLeetcode } from "react-icons/si";
import { RiInstagramFill } from "react-icons/ri"
function Footer() {
  const {isAuthorized}  = useContext(Context)
  return (
    <footer className= {isAuthorized ? "footerShow" : "footerHide"}>
<div>&copy; All Rights Reserved</div>
<div>
  <div className="icon-wrapper"><FaGithub /></div>
  <div className="icon-wrapper"><SiLeetcode /></div>
  <div className="icon-wrapper"><FaLinkedin /></div>
  <div className="icon-wrapper"><RiInstagramFill /></div>
</div>
      
    </footer>
  )
}

export default Footer
