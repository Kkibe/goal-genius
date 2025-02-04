import { MdArrowBackIos, MdArrowForwardIos } from 'react-icons/md';
import TipCard from '../../components/TipCard/TipCard';
import './Tips.scss';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import AppHelmet from '../AppHelmet';
import ScrollToTop from '../ScrollToTop';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { notificationState, planState, userState } from '../../recoil/atoms';
//import { tips } from '../../data';
import { trackPayment } from '../../utils/trackPayment';
import Loader from '../../components/Loader/Loader';
import { getTips, getUser, updateUserPlan } from '../../firebase';

export default function Tips() {
// 1. State Variables (useState)
const [isDragging, setIsDragging] = useState(false);
const [startX, setStartX] = useState(0);
const [scrollLeft, setScrollLeft] = useState(0);
const [firstIcon, setFirstIcon] = useState("flex");
const [lastIcon, setLastIcon] = useState("flex");
const [orderTrackingId, setOrderTrackingId] = useState(null);
const [orderMerchantReference, setOrderMerchantReference] = useState(null);
const [statusData, setStatusData] = useState(null);
const [loading, setLoading] = useState(false);
const [days, setDays] = useState(null);
const [currentDate, setCurrentDate] = useState(null);
const [user, setUser] = useRecoilState(userState);
const [isAdmin, setAdmin] = useState(false);
const [filteredTips, setFilteredTips] = useState(null);
const [gamesType, setGamesType] = useState("1X2");
const navigate = useNavigate();
const [tips, setTips] = useState(null);
const [plan, setPlan] = useRecoilState(planState);

// 2. Other Constants
const tabBoxRef = useRef();
const options = { year: 'numeric', month: 'long' };
const date = new Date(); // current date
const formattedDate = date.toLocaleDateString('en-US', options);
const setNotification = useSetRecoilState(notificationState);

// 3. Functions
const handleIcons = () => {
  let scrollVal = Math.round(tabBoxRef.current.scrollLeft);
  let maxScrollableWidth = tabBoxRef.current.scrollWidth - tabBoxRef.current.clientWidth;
  setFirstIcon(scrollVal > 0 ? "flex" : "none");
  setLastIcon(maxScrollableWidth > scrollVal + 1 ? "flex" : "none");
};

const handleClick = (direction) => {
  const scrollAmount = direction === "left" ? -350 : 350;
  tabBoxRef.current.scrollLeft += scrollAmount;
};

const getQueryParam = (param) => {
  const searchParams = new URLSearchParams(location.search);
  return searchParams.get(param);
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US');
};

const returnDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // Month is zero-indexed
  
  // Check if the date is invalid
  if (isNaN(date.getTime())) {
    console.error("Invalid date:", dateString);
    return "Invalid Date";
  }

  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

// 4. useEffects

useEffect(() => {
  const tabBox = tabBoxRef.current;
  
  const mouseDownHandler = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - tabBox.offsetLeft);
    setScrollLeft(tabBox.scrollLeft);
  };
  
  const mouseMoveHandler = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - tabBox.offsetLeft;
    const walk = (x - startX) * 2; // Adjust scroll speed
    tabBox.scrollLeft = scrollLeft - walk;
  };
  
  const mouseUpHandler = () => {
    setIsDragging(false);
  };
  
  tabBox.addEventListener('mousedown', mouseDownHandler);
  tabBox.addEventListener('mousemove', mouseMoveHandler);
  tabBox.addEventListener('mouseup', mouseUpHandler);
  tabBox.addEventListener('mouseleave', mouseUpHandler);
  tabBox.addEventListener('scroll', handleIcons);
  
  return () => {
    tabBox.removeEventListener('mousedown', mouseDownHandler);
    tabBox.removeEventListener('mousemove', mouseMoveHandler);
    tabBox.removeEventListener('mouseup', mouseUpHandler);
    tabBox.removeEventListener('mouseleave', mouseUpHandler);
    tabBox.removeEventListener('scroll', handleIcons); // Cleanup scroll listener
  };
}, [isDragging, startX, scrollLeft]);

// Initial call to handleIcons to set the icon visibility on component mount
useEffect(() => {
  setTimeout(() => {
    const tabBox = tabBoxRef.current;
    tabBox.scrollLeft = tabBox.scrollWidth - tabBox.clientWidth;
    handleIcons();
  }, 1000);
}, []);

// Fetch orderTrackingId and orderMerchantReference from query params
useEffect(() => {
  const trackingId = getQueryParam('OrderTrackingId');
  const merchantReference = getQueryParam('OrderMerchantReference');
  
  if (trackingId) {
    setOrderTrackingId(trackingId);
  }
  
  if (merchantReference) {
    setOrderMerchantReference(merchantReference);
  }
}, [location.search]);

const callbackFunction = async(status) => {

  if(status !== "Completed") return;
  await updateUserPlan(user.email, {
    type: plan.type,
    timeSlot: plan.timeSlot
  }, setNotification).then(() => {
    getUser(user.email, setUser);
  }).then(() => {
    navigate("/tips", { replace: true });
  })
}

// Fetch status data when orderTrackingId is available
useEffect(() => {
  if (orderTrackingId) {
    trackPayment(orderTrackingId, setNotification, setStatusData, setLoading);
  }
}, [orderTrackingId]);

useEffect(() => {
  statusData && callbackFunction(statusData.payment_status_description)
}, [statusData]);

// Fetch last 30 days of dates
useEffect(() => {
  let dates = [];
  for (let i = 0; i < 30; i++) {
    let date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  setDays(dates.reverse());
}, []);

// Set currentDate when days is available
useEffect(() => {
  days && setCurrentDate(days[days.length - 1]);
}, [days]);

useEffect(() =>{
  getTips(setTips, setLoading, formatDate(currentDate));
}, [currentDate]);

// Filter tips into time slots
useEffect(() => {
  if (tips !== null) {
    const groupedData = tips.reduce((acc, item) => {
      const time = item.time;
      const [hours, minutes] = time.split(':').map(Number);
      
      let timeSlot = '';
      if (hours >= 0 && hours < 6) {
        timeSlot = 'Morning';
      } else if (hours >= 6 && hours < 12) {
        timeSlot = 'Afternoon';
      } else if (hours >= 12 && hours < 18) {
        timeSlot = 'Evening';
      } else if (hours >= 18 && hours <= 23) {
        timeSlot = 'Night';
      }
      
      if (!acc[timeSlot]) {
        acc[timeSlot] = [];
      }
      
      acc[timeSlot].push(item);
      
      return acc;
    }, {});
    
    const result = Object.keys(groupedData).map(timeSlot => ({
      timeSlot,
      items: groupedData[timeSlot]
    })).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    
    setFilteredTips(result);
  }
}, [tips]);

// Update premium status based on user state
useEffect(() => {
  if (user && ['kkibetkkoir@gmail.com', 'charleykibet254@gmail.com', 'aronkorir8@gmail.com'].includes(user.email)) {
    setAdmin(true);
  } else {
    setAdmin(false);
  }
}, [user]);

  return (
    <div className='tips'>
      <AppHelmet title={"Tips"}/>
      <ScrollToTop />
      {loading && <Loader />}
      {!loading && (
        <>
          <div className="date-wrapper">
            <div className="icon" style={{display: firstIcon}}><MdArrowBackIos className='item' onClick={() => handleClick("left")}/></div>
            <ul className={`tabs-box ${isDragging ? "dragging" : ""}`} ref={tabBoxRef} style={{
              overflow: 'auto',
              whiteSpace: 'nowrap',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}>
              {days && days.map((day) => (
                <li className={`tab ${(currentDate === day) && 'active'}`} onClick={() => setCurrentDate(day)} key={days.indexOf(day)} aria-label={day}>
                  <span>{returnDate(day).split(" ")[0]}</span>
                  <span>{returnDate(day).split(" ")[1]}  {returnDate(day).split(" ")[2]}</span>
                </li>
              ))}
            </ul>
            <div className="icon" style={{display: lastIcon}}><MdArrowForwardIos className='item' onClick={() => handleClick("right")}/></div>
          </div>
          <NavLink to={`${user && user.isPremium ? '/plans' : "/pricing"}`} className={"subscribe-btn"}>SUBSCRIBE TO VIEW TIPS</NavLink>
          <form className="type">
            <fieldset>
              <input name="games-type" type="radio" value={"1X2"} id="1X2" checked={gamesType === "1X2"} onChange={(e) => setGamesType(e.target.value)}/>
              <label htmlFor="1X2">WDW (1X2)</label>
            </fieldset>
            <fieldset>
              <input name="games-type" type="radio" value={"CS"} id="CS" checked={gamesType === "CS"} onChange={(e) => setGamesType(e.target.value)}/>
              <label htmlFor="CS">Goals (CS)</label>
            </fieldset>
            <fieldset>
              <input name="games-type" type="radio" value={"GG"} id="GG" checked={gamesType === "GG"} onChange={(e) => setGamesType(e.target.value)}/>
              <label htmlFor="GG">BTTS (GG/NG)</label>
            </fieldset>
            <fieldset>
              <input name="games-type" type="radio" value={"OV_UN"} id="OV_UN" checked={gamesType === "OV_UN"} onChange={(e) => setGamesType(e.target.value)}/>
              <label htmlFor="OV_UN">TOTAL (OV/UN)</label>
            </fieldset>
            <fieldset>
              <input name="games-type" type="radio" value={"DC"} id="DC" checked={gamesType === "DC"} onChange={(e) => setGamesType(e.target.value)}/>
              <label htmlFor="DC">DC 1X2</label>
            </fieldset>
          </form>
          
          {filteredTips && filteredTips.map(filteredTip => {
            const timeSlotDescription = {
              'Morning': 'Morning (12AM-6AM)',
              'Afternoon': 'Afternoon (6AM-12PM)',
              'Evening': 'Evening (12PM-6PM)',
              'Night': 'Night (6PM-12AM)'
            }[filteredTip.timeSlot];
            
            return (
              <div className="container" key={filteredTip.timeSlot}>
                {filteredTip.items && filteredTip.items.filter(doc => doc.type === gamesType).length !== 0 && (<h2 className='title'>{timeSlotDescription}</h2>)}
                <div className="tips-content container">
                  {filteredTip.items.filter(doc => doc.type === gamesType).map((tip, index) => (
                    <TipCard key={index} tip={tip} timeSlot={timeSlotDescription} isAdmin={isAdmin} plan={user && user.plan ? user.plan : null}/>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
