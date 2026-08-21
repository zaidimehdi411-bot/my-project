

function showRegister(){
 document.getElementById("loginPage").style.display="none";
 document.getElementById("registerPage").style.display="flex";
}

function hideRegister(){
 document.getElementById("registerPage").style.display="none";
 document.getElementById("loginPage").style.display="flex";
}

function registerCompany(){

 const company=document.getElementById("regCompany").value.trim();
 const manager=document.getElementById("regManager").value.trim();
 const email=document.getElementById("regEmail").value.trim();

 if(!company || !manager || !email){
  alert("يرجى ملء جميع البيانات");
  return;
 }

 fetch("http://127.0.0.1:5000/api/companies",{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body:JSON.stringify({
   name:company,
   manager:manager,
   email:email
  })
 })
 .then(response=>response.json())
 .then(data=>{

  if(data.success){

   document.getElementById("registerMessage").textContent=
   "تم حفظ الشركة في قاعدة البيانات ✅";

   setTimeout(hideRegister,1000);

  }else{

   alert(data.error || "حدث خطأ");

  }

 })
 .catch(error=>{
  alert("تعذر الاتصال بالخادم");
  console.error(error);
 });
}



function login(){

 const username=document.getElementById("loginUser").value.trim();
 const password=document.getElementById("loginPass").value;

 if(!username || !password){
  alert("يرجى إدخال اسم المستخدم وكلمة المرور");
  return;
 }

 fetch("http://127.0.0.1:5000/api/login",{
  method:"POST",
  credentials:"include",
  headers:{
   "Content-Type":"application/json"
  },
  body:JSON.stringify({
   username:username,
   password:password
  })
 })
 .then(response=>response.json())
 .then(data=>{

  if(data.success){

   localStorage.setItem("companydesk_user",JSON.stringify(data));

   document.getElementById("userProfile").textContent="👤 "+data.username+" — "+data.role; alert("تم تسجيل الدخول بنجاح ✅");

   if(typeof showApp === "function"){
    showApp();
   }else{
    location.reload();
   }

  }else{

   alert(data.error || "بيانات الدخول غير صحيحة");

  }

 })
 .catch(error=>{
  alert("تعذر الاتصال بالخادم");
  console.error(error);
 });
}


function showApp(){
 applyPermissions();
 document.getElementById("loginPage").style.display="none";
 document.getElementById("registerPage").style.display="none";
 document.querySelector(".app").style.display="flex";

 const user=JSON.parse(localStorage.getItem("companydesk_user") || "{}");
 const profile=document.getElementById("userProfile");

 if(profile && user.username){
  profile.textContent="👤 "+user.username+" — "+(user.role || "مستخدم");
 }
}

let tickets = [];

function loadTicketsFromServer(){

 fetch("http://127.0.0.1:5000/api/tickets",{
  credentials:"include"
 })
 .then(response=>response.json())
 .then(data=>{

  if(data.error){
   console.error(data.error);
   return;
  }

  tickets = (data.tickets || []).map(t=>({
   id:t.id,
   number:t.id,
   title:t.title,
   employee:t.employee_name || "",
   employee_id:t.employee_id || "",
   department:t.location || "",
   employee_name:t.employee_name || "",
   priority:t.priority,
   status:t.status
  }));

  renderServerTickets();
  updateStats();

 })
 .catch(error=>{
  console.error("تعذر تحميل الطلبات:",error);
 });
}

function renderServerTickets(){

 const list=document.getElementById("tickets");

 list.innerHTML="";

 tickets.forEach(t=>{

  const ticket=document.createElement("div");
  ticket.className="ticket";
  ticket.dataset.search=(t.title+" "+t.department+" "+t.employee_name).toLowerCase();

  ticket.innerHTML=`
  <div class="ticket-top">

   <div class="ticket-title">
    #${t.number} — ${t.title}
   </div>

   <span class="badge ${t.priority}">
    ${
     t.priority==="high" ? "عاجل" :
     t.priority==="medium" ? "متوسط" : "عادي"
    }
   </span>

  </div>

  <div class="ticket-info">
   👤 ${t.employee_name || "غير محدد"}
   · 🏢 ${t.department || "غير محدد"}
  </div>

  <div style="margin-top:12px">

   <label style="font-size:13px;color:#718096">
    حالة الطلب:
   </label>

   <select
    onchange="changeStatus(${t.id || t.number}, this.value)"
    style="
     padding:9px;
     margin-right:6px;
     border:1px solid #dce2ea;
     border-radius:8px;
     background:white;
    "
   >

    <option value="new" ${t.status==="new" ? "selected" : ""}>
     🆕 جديد
    </option>

    <option value="working" ${t.status==="working" ? "selected" : ""}>
     🔧 قيد التنفيذ
    </option>

    <option value="done" ${t.status==="done" ? "selected" : ""}>
     ✅ تم الحل
    </option>

   </select>

   ${JSON.parse(localStorage.getItem("companydesk_user") || "{}").role === "manager" ? `
   <select
    onchange="assignTicket(${t.id || t.number}, this.value)"
    style="
     padding:9px;
     margin-right:6px;
     border:1px solid #dce2ea;
     border-radius:8px;
     background:white;
    "
   >
    <option value="">👤 إسناد الموظف</option>
    ${employees.map(e => `
     <option value="${e.id}" ${Number(t.employee_id) === Number(e.id) ? "selected" : ""}>
      ${e.name}
     </option>
    `).join("")}
   </select>
   ` : ""}

  </div>
  `;

  list.appendChild(ticket);

 });
}

function assignTicket(ticketId, employeeId){

 if(!employeeId) return;

 fetch("http://127.0.0.1:5000/api/tickets/"+ticketId+"/assign",{
  method:"PUT",
  headers:{
   "Content-Type":"application/json"
  },
  credentials:"include",
  body:JSON.stringify({
   employee_id:Number(employeeId)
  })
 })
 .then(response=>response.json())
 .then(data=>{

  if(data.success){
   alert("تم إسناد الطلب #"+ticketId+" ✅");
   loadTicketsFromServer();
  }else{
   alert(data.error || "تعذر إسناد الطلب");
  }

 })
 .catch(error=>{
  console.error(error);
  alert("تعذر الاتصال بالخادم");
 });
}


function saveTickets(){ localStorage.setItem("companydesk_tickets", JSON.stringify(tickets)); }
function loadTickets(){
 const list=document.getElementById("tickets");
 tickets.forEach(t=>{
  const ticket=document.createElement("div");
  ticket.className="ticket";
  ticket.dataset.search=t.title+" "+t.department;

  if(!t.status) t.status="new";

  ticket.innerHTML=`
  <div class="ticket-top">
   <div class="ticket-title">#${t.number} — ${t.title}</div>
   <span class="badge ${t.priority}">${
    t.priority==="high" ? "عاجل" :
    t.priority==="medium" ? "متوسط" : "عادي"
   }</span>
  </div>
  <div class="ticket-info">
   👤 ${t.employee || "غير محدد"}
   · 🏢 ${t.department || "غير محدد"}
   · محفوظ
  </div>
  <div style="margin-top:10px">
   <select onchange="changeStatus('${t.number}',this.value)"
   style="padding:8px;border:1px solid #ddd;border-radius:8px">
    <option value="new" ${t.status==="new"?"selected":""}>🆕 جديد</option>
    <option value="working" ${t.status==="working"?"selected":""}>🔧 قيد التنفيذ</option>
    <option value="done" ${t.status==="done"?"selected":""}>✅ تم الحل</option>
   </select>
  </div>
  `;

  list.prepend(ticket);
 });
}


function loadDepartmentsForTicket(){

    const select = document.getElementById("newDepartment");
    if(!select) return;

    const user = JSON.parse(
        localStorage.getItem("companydesk_user") || "{}"
    );

    const companyId = user.company_id || 1;

    fetch(
        "http://127.0.0.1:5000/api/departments?company_id=" + companyId,
        { credentials: "include" }
    )
    .then(response => response.json())
    .then(data => {

        select.innerHTML = '<option value="">اختر القسم</option>';

        (data.departments || []).forEach(department => {

            const option = document.createElement("option");

            option.value = department.name;
            option.textContent = department.name;

            select.appendChild(option);
        });
    })
    .catch(error => {
        console.error("خطأ في تحميل الأقسام:", error);
    });
}

function openNewTicket(){
 const form = document.getElementById("newTicket");

 if(form){
  form.style.display="block";
  loadDepartmentsForTicket();
 }
}

function closeNewTicket(){
 document.getElementById("newTicket").style.display="none";
}

function addTicket(){

 const title=document.getElementById("newTitle").value.trim();
 const employee=document.getElementById("newEmployee").value.trim();
 const department=document.getElementById("newDepartment").value.trim();
 const priority=document.getElementById("newPriority").value;

 const selectedEmployee = employees.find(
  e => e.name.trim().toLowerCase() === employee.toLowerCase()
 );

 if(!title){
  alert("اكتب وصف المشكلة");
  return;
 }

 if(employee && !selectedEmployee){
  alert("الموظف غير موجود في قاعدة البيانات");
  return;
 }

 fetch("http://127.0.0.1:5000/api/tickets",{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  credentials:"include",
  body:JSON.stringify({
   title:title,
   description:title,
   location:department,
   priority:priority,
   employee_id:selectedEmployee ? selectedEmployee.id : null
  })
 })
 .then(response=>response.json())
 .then(data=>{

  if(data.success){

   alert("تم حفظ طلب الصيانة رقم #"+data.ticket_id+" ✅");

   document.getElementById("newTitle").value="";
   document.getElementById("newEmployee").value="";
   document.getElementById("newDepartment").value="";
   document.getElementById("newPriority").value="low";

   closeNewTicket();

  }else{

   alert(data.error || "تعذر حفظ طلب الصيانة");

  }

 })
 .catch(error=>{
  alert("تعذر الاتصال بالخادم");
  console.error(error);
 });
}


function updateStats(){
 const total=tickets.length;
 const working=tickets.filter(t=>t.status==="working").length;
 const urgent=tickets.filter(t=>t.priority==="high").length;
 const done=tickets.filter(t=>t.status==="done").length;

 document.getElementById("totalCount").textContent=total;
 document.getElementById("workingCount").textContent=working;
 document.getElementById("urgentCount").textContent=urgent;
 document.getElementById("doneCount").textContent=done;
}

function changeStatus(number,status){

 const ticket=tickets.find(t=>t.number===number);

 if(!ticket) return;

 const ticketId = ticket.id || ticket.number;

 fetch("http://127.0.0.1:5000/api/tickets/"+ticketId+"/status",{
  method:"PUT",
  headers:{
   "Content-Type":"application/json"
  },
  credentials:"include",
  body:JSON.stringify({
   status:status
  })
 })
 .then(response=>response.json())
 .then(data=>{

  if(data.success){

   ticket.status=status;
   saveTickets();
   updateStats();

   alert("تم تحديث حالة الطلب #"+ticketId+" ✅");

  }else{

   alert(data.error || "تعذر تحديث حالة الطلب");

  }

 })
 .catch(error=>{
  alert("تعذر الاتصال بالخادم");
  console.error(error);
 });
}

let employees = [];

function loadEmployees(){
 fetch("http://127.0.0.1:5000/api/employees?company_id=1")
 .then(r=>r.json())
 .then(data=>{
  employees = data.employees || data || [];
  renderEmployees();
  populateEmployeeSelect();

  if (typeof tickets !== "undefined" && tickets.length) {
   renderServerTickets();
  }
 })
 .catch(error=>{
  console.error(error);
  alert("تعذر تحميل الموظفين");
 });
}

function populateEmployeeSelect(){

 const select = document.getElementById("newEmployee");

 if(!select) return;

 select.innerHTML = '<option value="">اختر الموظف</option>';

 employees.forEach(e => {

  const option = document.createElement("option");

  option.value = e.name;
  option.textContent = e.name + (e.department ? " — " + e.department : "");

  select.appendChild(option);

 });
}

function saveEmployees(){
 localStorage.setItem(
  "companydesk_employees",
  JSON.stringify(employees)
 );
}


function loadDepartmentsForEmployee(){

    const select = document.getElementById("employeeDepartment");
    if(!select) return;

    const user = JSON.parse(
        localStorage.getItem("companydesk_user") || "{}"
    );

    const companyId = user.company_id || 1;

    fetch(
        "http://127.0.0.1:5000/api/departments?company_id=" + companyId,
        { credentials: "include" }
    )
    .then(response => response.json())
    .then(data => {

        select.innerHTML = '<option value="">اختر القسم</option>';

        (data.departments || []).forEach(department => {

            const option = document.createElement("option");

            option.value = department.name;
            option.textContent = department.name;

            select.appendChild(option);
        });

    })
    .catch(error => {
        console.error("خطأ في تحميل الأقسام:", error);
    });
}

function openEmployeeForm(){
 loadDepartmentsForEmployee();

 document.getElementById("employeeForm").style.display="block";
}

function closeEmployeeForm(){
 document.getElementById("employeeForm").style.display="none";
}

function addEmployee(){

 const name=document.getElementById("employeeName").value.trim();
 const department=document.getElementById("employeeDepartment").value.trim();

 if(!name){
  alert("اكتب اسم الموظف");
  return;
 }

 fetch("http://127.0.0.1:5000/api/employees",{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body:JSON.stringify({
   company_id:1,
   name:name,
   department:department
  })
 })
 .then(response=>response.json())
 .then(data=>{

  if(data.success){

   document.getElementById("employeeName").value="";
   document.getElementById("employeeDepartment").value="";

   closeEmployeeForm();
   renderEmployees();

  }else{

   alert(data.error || "حدث خطأ أثناء حفظ الموظف");

  }

 })
 .catch(error=>{
  alert("تعذر الاتصال بالخادم");
  console.error(error);
 });
}

function renderEmployees(){

 const list=document.getElementById("employeesList");
 const search=(document.getElementById("employeeSearch").value || "").toLowerCase();

 list.innerHTML="";

 employees
 .filter(e=>
  e.name.toLowerCase().includes(search) ||
  e.department.toLowerCase().includes(search)
 )
 .forEach(e=>{

  const assigned=tickets.filter(t=>t.employee===e.name).length;
  const done=tickets.filter(t=>t.employee===e.name && t.status==="done").length;

  list.innerHTML+=`
  <div class="ticket">

   <div class="ticket-top">
    <div class="ticket-title">👤 ${e.name}</div>
    <span class="badge low">${e.department || "بدون قسم"}</span>
   </div>

   <div class="ticket-info">
    📋 الطلبات: ${assigned}
    · ✅ المنجزة: ${done}
   </div>

  </div>
  `;
 });
}

function changePassword(){

 const current=document.getElementById("currentPassword").value;
 const newPass=document.getElementById("newPassword").value;
 const confirm=document.getElementById("confirmPassword").value;

 if(!current || !newPass || !confirm){
  alert("يرجى ملء جميع الحقول");
  return;
 }

 if(newPass !== confirm){
  alert("كلمتا المرور غير متطابقتين");
  return;
 }

 if(newPass.length < 8){
  alert("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
  return;
 }

 const user=JSON.parse(
  localStorage.getItem("companydesk_user") || "{}"
 );

 fetch("http://127.0.0.1:5000/api/change-password",{
  method:"POST",
  headers:{
   "Content-Type":"application/json"
  },
  body:JSON.stringify({
   user_id:user.user_id,
   current_password:current,
   new_password:newPass
  })
 })
 .then(r=>r.json())
 .then(data=>{
  if(data.success){
   document.getElementById("passwordMessage").textContent=
    "تم تغيير كلمة المرور بنجاح ✅";
   document.getElementById("currentPassword").value="";
   document.getElementById("newPassword").value="";
   document.getElementById("confirmPassword").value="";
  }else{
   alert(data.error || "تعذر تغيير كلمة المرور");
  }
 })
 .catch(()=>{
  alert("تعذر الاتصال بالخادم");
 });
}

function logout(){
 localStorage.removeItem("companydesk_user");
 location.reload();
}

function applyPermissions(){

 const user=JSON.parse(
  localStorage.getItem("companydesk_user") || "{}"
 );

 if(user.role === "employee"){

  document.querySelectorAll(".nav button").forEach(button=>{

   const text=button.textContent;

   if(
    text.includes("الموظفون") ||
    text.includes("الأقسام") ||
    text.includes("التقارير")
   ){
    button.style.display="none";
   }

  });

 }

}

function showSettings(){

 document.querySelector(".main").style.display="none";
 document.getElementById("employeesPage").style.display="none";
 document.getElementById("settingsPage").style.display="block";

 const user=JSON.parse(
  localStorage.getItem("companydesk_user") || "{}"
 );

 document.getElementById("settingsUsername").textContent=
  "اسم المستخدم: "+(user.username || "غير معروف");

 document.getElementById("settingsRole").textContent=
  "الدور: "+(user.role || "غير معروف");
}

function toggleTheme(){
 document.body.classList.toggle("dark-mode");
}

function hideAllPages(){

 document.querySelector(".main").style.display="none";
 document.getElementById("employeesPage").style.display="none";
 document.getElementById("settingsPage").style.display="none";

 const maintenance = document.getElementById("maintenancePage");
 if(maintenance) maintenance.style.display="none";

 const departments = document.getElementById("departmentsPage");
 if(departments) departments.style.display="none";

}


function openDepartmentForm(){
    const form = document.getElementById("departmentForm");
    const input = document.getElementById("departmentName");

    if(form) form.style.display = "block";
    if(input){
        input.value = "";
        input.focus();
    }
}

function closeDepartmentForm(){
    const form = document.getElementById("departmentForm");
    if(form) form.style.display = "none";
}

function renderDepartments(){
    const list = document.getElementById("departmentsList");
    if(!list) return;

    const searchInput = document.getElementById("departmentSearch");
    const search = (searchInput ? searchInput.value : "").toLowerCase().trim();

    list.innerHTML = "";

    departments
        .filter(d => (d.name || "").toLowerCase().includes(search))
        .forEach(d => {
            const item = document.createElement("div");

            item.className = "ticket";

            item.innerHTML = `
                <div class="ticket-top">
                    <div class="ticket-title">
                        🏢 ${d.name}
                    </div>
                    <span class="badge low">قسم</span>
                </div>
            `;

            list.appendChild(item);
        });

    if(!list.children.length){
        list.innerHTML = `
            <div style="padding:20px;text-align:center;color:#718096">
                لا توجد أقسام
            </div>
        `;
    }
}

function addDepartment(){

    const input = document.getElementById("departmentName");
    const name = input ? input.value.trim() : "";

    if(!name){
        alert("يرجى إدخال اسم القسم");
        return;
    }

    const user = JSON.parse(
        localStorage.getItem("companydesk_user") || "{}"
    );

    const companyId = user.company_id || 1;

    fetch(
        "http://127.0.0.1:5000/api/departments",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                company_id: companyId,
                name: name
            })
        }
    )
    .then(response => response.json())
    .then(data => {

        if(data.success){

            closeDepartmentForm();
            loadDepartments();

            alert("تمت إضافة القسم بنجاح ✅");

        }else{

            alert(data.error || "تعذر إضافة القسم");

        }

    })
    .catch(error => {

        console.error(error);
        alert("تعذر الاتصال بالخادم");

    });
}

function loadDepartments(){

    const user = JSON.parse(
        localStorage.getItem("companydesk_user") || "{}"
    );

    const companyId = user.company_id || 1;

    fetch(
        "http://127.0.0.1:5000/api/departments?company_id=" + companyId,
        {
            credentials: "include"
        }
    )
    .then(response => response.json())
    .then(data => {

        departments = data.departments || [];

        renderDepartments();

    })
    .catch(error => {

        console.error(error);
        alert("تعذر تحميل الأقسام");

    });
}

function showDepartments(){

 hideAllPages();

 const page = document.getElementById("departmentsPage");

 if(page){
  page.style.display="block";
 }

 loadDepartments();
}

function showDashboard(){

 hideAllPages();

 const main = document.querySelector(".main");
 const maintenance = document.getElementById("maintenancePage");

 main.style.display = "block";

 Array.from(main.children).forEach(el => {
  el.style.display = "block";
 });

 if(maintenance){
  maintenance.style.display = "none";
 }

}

function showEmployees(){

 hideAllPages();
 document.getElementById("employeesPage").style.display="block";

 renderEmployees();
}

function showSettings(){

 hideAllPages();
 document.getElementById("settingsPage").style.display="block";

 const user = JSON.parse(
  localStorage.getItem("companydesk_user") || "{}"
 );

 const username = document.getElementById("settingsUsername");
 const role = document.getElementById("settingsRole");

 if(username) username.textContent = "👤 " + (user.username || "غير معروف");
 if(role) role.textContent = "الدور: " + (user.role || "غير معروف");
}

function searchTickets(value){

 value=value.toLowerCase();

 document.querySelectorAll(".ticket").forEach(ticket=>{

  const text=ticket.dataset.search.toLowerCase();

  ticket.style.display=
   text.includes(value) ? "block" : "none";

 });
}
loadTicketsFromServer();
loadEmployees();
